// @vitest-environment node

import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn(), cancel: vi.fn() }));
const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    resolve4 = dns.resolve4;
    resolve6 = dns.resolve6;
    cancel = dns.cancel;
  },
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));
vi.mock('node:https', () => ({ request: transport.request }));

import { buildDocumentApiApp, MAX_DOCUMENT_BYTES } from '../app.ts';
import { createDocumentStore } from '../documentStore.ts';
import { importTlsCertificate, importTlsKey } from './support/importTlsFixture.ts';

async function docx(text: string) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', `<document>${text}</document>`);
  return Buffer.from(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));
}

describe('URL import security boundary', () => {
  let directory: string;
  let app: ReturnType<typeof buildDocumentApiApp>;
  let payload: Buffer;
  const responses: IncomingMessage[] = [];
  const requests: Array<{ url: URL; options: RequestOptions; request: ClientRequest }> = [];
  let replyUpstream: (url: URL) => IncomingMessage;
  let firstHeadersDelayMs = 0;

  function response(body: Buffer = payload, headers = {}, statusCode = 200, end = true) {
    const stream = Object.assign(new PassThrough(), {
      statusCode,
      headers: { 'content-type': 'application/octet-stream', ...headers },
    });
    responses.push(stream as unknown as IncomingMessage);
    if (end) stream.end(body);
    return stream as unknown as IncomingMessage;
  }

  function importUrl(url = 'https://public.example/template.docx') {
    return app.inject({ method: 'POST', url: '/api/documents/import-url', payload: { url } });
  }

  async function flushRequest() {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    responses.length = 0;
    requests.length = 0;
    firstHeadersDelayMs = 0;
    payload = await docx('public document');
    dns.resolve4.mockResolvedValue(['93.184.216.34']);
    dns.resolve6.mockResolvedValue([]);
    // The old fetch path is kept as a deterministic control during RED;
    // the patched implementation must use the pinned HTTPS transport instead.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array(payload).buffer));
    replyUpstream = () => response();
    transport.request.mockImplementation((url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
      const request = new EventEmitter() as ClientRequest;
      let headersTimer: ReturnType<typeof setTimeout> | undefined;
      let upstream: IncomingMessage | undefined;
      const abort = () => request.destroy();
      request.destroy = () => {
        if (request.destroyed) return request;
        Object.defineProperty(request, 'destroyed', { value: true });
        options.signal?.removeEventListener('abort', abort);
        clearTimeout(headersTimer);
        upstream?.destroy(new Error('connection closed'));
        request.emit('error', new Error('connection closed'));
        return request;
      };
      request.end = (() => {
        options.signal?.addEventListener('abort', abort, { once: true });
        const deliver = () => { upstream = replyUpstream(url); callback(upstream); };
        if (requests.length === 1 && firstHeadersDelayMs) headersTimer = setTimeout(deliver, firstHeadersDelayMs);
        else queueMicrotask(deliver);
        return request;
      }) as ClientRequest['end'];
      requests.push({ url, options, request });
      return request;
    });
    directory = await mkdtemp(path.join(tmpdir(), 'docx-import-'));
    app = buildDocumentApiApp({ store: createDocumentStore({ rootDirectory: directory }), rateLimitMaxRequests: false });
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const stream of responses) stream.destroy();
    await app.close();
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('pins validated DNS answers without sending the request through a second resolver', async () => {
    // A second DNS lookup would now point at an internal service.
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(new Uint8Array(await docx('private service secret')).buffer));
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockResolvedValue(['127.0.0.1']);
    const result = await importUrl();
    expect(result.statusCode).toBe(201);
    const saved = await app.inject({ method: 'GET', url: `/api/documents/${result.json().id}/content` });
    expect(saved.rawPayload).toEqual(payload);
    expect(requests[0].url.hostname).toBe('public.example');
    expect(requests[0].options.agent).toBe(false);
    expect(requests[0].options.headers).toEqual(expect.objectContaining({ 'accept-encoding': 'identity' }));
    const lookup = requests[0].options.lookup!;
    const addresses = await new Promise((resolve, reject) => {
      lookup('public.example', { all: true }, (error, value) => error ? reject(error) : resolve(value));
    });
    expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it.each(['valid', 'wrong-host', 'untrusted', 'upgrade'] as const)(
    'uses native HTTPS hostname verification and settles upstream lifecycle (%s)', async (mode) => {
      const nativeHttps = await vi.importActual<typeof import('node:https')>('node:https');
      const receivedHosts: Array<string | undefined> = [];
      const upstream = nativeHttps.createServer({ key: importTlsKey, cert: importTlsCertificate }, (req, res) => {
        receivedHosts.push(req.headers.host);
        if (mode === 'upgrade') {
          res.writeHead(101, { connection: 'Upgrade', upgrade: 'websocket' });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        res.end(payload);
      });
      await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
      const port = (upstream.address() as import('node:net').AddressInfo).port;
      transport.request.mockImplementation((url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
        // Test-only wire redirection to loopback. Keep URL/Host/TLS verification intact;
        // the separate pinning test checks the production lookup's exact address set.
        return nativeHttps.request(url, {
          ...options,
          ...(mode === 'untrusted' ? {} : { ca: importTlsCertificate }),
          lookup: (_host, lookupOptions, done) => {
            if (lookupOptions.all) {
              const allDone = done as unknown as (error: null, addresses: Array<{ address: string; family: number }>) => void;
              allDone(null, [{ address: '127.0.0.1', family: 4 }]);
              return;
            }
            done(null, '127.0.0.1', 4);
          },
        }, callback);
      });
      try {
        const hostname = mode === 'wrong-host' ? 'other.example' : 'public.example';
        const result = await importUrl(`https://${hostname}:${port}/template.docx`);
        expect(result.statusCode).toBe(mode === 'valid' ? 201 : 400);
        if (mode === 'valid') {
          expect(receivedHosts).toEqual([`public.example:${port}`]);
          const saved = await app.inject({ method: 'GET', url: `/api/documents/${result.json().id}/content` });
          expect(saved.rawPayload).toEqual(payload);
        } else {
          expect((await app.inject({ method: 'GET', url: '/api/documents' })).json()).toEqual([]);
        }
      } finally {
        upstream.closeAllConnections();
        await new Promise<void>((resolve) => upstream.close(() => resolve()));
      }
    },
  );

  it.each([
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '240.0.0.1',
    '::', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe90::1', 'ff02::1', '2002:7f00:1::',
  ])('rejects non-public DNS answer %s without persistence', async (address) => {
    dns.resolve4.mockResolvedValue(address.includes(':') ? [] : [address]);
    dns.resolve6.mockResolvedValue(address.includes(':') ? [address] : []);
    expect((await importUrl()).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/documents' })).json()).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('rejects mixed public/private answers rather than selecting the public one', async () => {
    dns.resolve6.mockResolvedValue(['::ffff:a00:1']);
    expect((await importUrl()).statusCode).toBe(400);
    expect(requests).toHaveLength(0);
  });

  it.each(['https://[::ffff:127.0.0.1]/x.docx', 'https://2130706433/x.docx', 'https://user:secret@public.example/x.docx', 'http://public.example/x.docx'])('rejects unsafe literal URL %s', async (url) => {
    expect((await importUrl(url)).statusCode).toBe(400);
    expect(requests).toHaveLength(0);
  });

  it('preserves public redirects, query strings, IPv6 answers and the final Unicode filename', async () => {
    dns.resolve6.mockResolvedValue(['2606:4700:4700::1111']);
    replyUpstream = (url) => url.hostname === 'public.example'
      ? response(Buffer.alloc(0), { location: 'https://cdn.example/B%C3%A1o%20c%C3%A1o.docx?download=1' }, 302, false)
      : response(payload, { 'content-type': 'application/zip; charset=binary' });
    const result = await importUrl('https://public.example/uc?export=download&id=example');
    expect(result.statusCode).toBe(201);
    expect(result.json().name).toBe('Báo cáo.docx');
    expect(requests.map(({ url }) => url.search)).toEqual(['?export=download&id=example', '?download=1']);
    expect(responses[0].destroyed).toBe(true);
  });

  it('rejects private redirect destinations and closes the redirect body', async () => {
    replyUpstream = () => response(Buffer.alloc(0), { location: 'https://127.0.0.1/internal.docx' }, 302, false);
    expect((await importUrl()).statusCode).toBe(400);
    expect(requests).toHaveLength(1);
    expect(responses[0].destroyed).toBe(true);
  });

  it.each([
    [{ 'content-encoding': 'gzip' }, 200],
    [{ 'content-encoding': 'br' }, 200],
    [{ 'content-type': 'text/html' }, 200],
    [{ 'content-length': String(50 * 1024 * 1024 + 1) }, 200],
    [{ 'content-length': '-1' }, 200],
    [{}, 503],
    [{}, 302],
  ])('rejects unsafe upstream headers/status and closes the body (%j / %s)', async (headers, status) => {
    replyUpstream = () => response(Buffer.alloc(0), headers, status, false);
    expect((await importUrl()).statusCode).toBe(400);
    expect(responses[0].destroyed).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/documents' })).json()).toEqual([]);
  });

  it('bounds the streamed body even without a content-length header', async () => {
    replyUpstream = () => response(Buffer.alloc(MAX_DOCUMENT_BYTES + 1));
    expect((await importUrl()).statusCode).toBe(400);
    expect(responses[0].destroyed).toBe(true);
  });

  it('does not persist a non-DOCX response with an allowed MIME type', async () => {
    replyUpstream = () => response(Buffer.from('not a DOCX'));
    expect((await importUrl()).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/documents' })).json()).toEqual([]);
  });

  it('uses a single deadline across redirects and a stalled body', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    firstHeadersDelayMs = 12_000;
    replyUpstream = (url) => url.hostname === 'public.example'
      ? response(Buffer.alloc(0), { location: 'https://cdn.example/x.docx' }, 302, false)
      : response(Buffer.alloc(0), {}, 200, false);
    const pending = importUrl();
    await flushRequest();
    await vi.advanceTimersByTimeAsync(12_000);
    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).statusCode).toBe(400);
    expect(responses.every((stream) => stream.destroyed)).toBe(true);
  });

  it('aborts a stalled TLS/headers request at the same deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    firstHeadersDelayMs = 60_000;
    const pending = importUrl();
    await flushRequest();
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).statusCode).toBe(400);
    expect(requests[0].request.destroyed).toBe(true);
    expect(responses).toHaveLength(0);
  });

  it('rejects a connection closed before a final response instead of leaking the import slot', async () => {
    transport.request.mockImplementationOnce(() => {
      const request = new EventEmitter() as ClientRequest;
      request.end = (() => { queueMicrotask(() => request.emit('close')); return request; }) as ClientRequest['end'];
      return request;
    });
    const result = await Promise.race([
      importUrl().then((result) => result.statusCode),
      new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 150)),
    ]);
    expect(result).toBe(400);
  });

  it('does not reset the deadline when redirected DNS stalls', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    firstHeadersDelayMs = 12_000;
    let rejectDns: (error: Error) => void = () => {};
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDns = reject; }));
    dns.cancel.mockImplementation(() => rejectDns(new Error('cancelled')));
    replyUpstream = () => response(Buffer.alloc(0), { location: '/next.docx' }, 302, false);
    const pending = importUrl();
    await flushRequest();
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).statusCode).toBe(400);
    expect(requests).toHaveLength(1);
    expect(responses[0].destroyed).toBe(true);
  });

  it('caps redirect loops and closes every upstream response', async () => {
    replyUpstream = () => response(Buffer.alloc(0), { location: '/loop.docx' }, 302, false);
    expect((await importUrl()).statusCode).toBe(400);
    expect(requests).toHaveLength(4);
    expect(responses.every((stream) => stream.destroyed)).toBe(true);
  });

  it('accepts a missing DNS family but fails closed on resolver errors', async () => {
    dns.resolve6.mockRejectedValueOnce(Object.assign(new Error('no IPv6'), { code: 'ENODATA' }));
    expect((await importUrl()).statusCode).toBe(201);
    dns.resolve6.mockRejectedValueOnce(Object.assign(new Error('resolver failed'), { code: 'ESERVFAIL' }));
    expect((await importUrl()).statusCode).toBe(400);
    dns.resolve4.mockResolvedValueOnce([]);
    dns.resolve6.mockResolvedValueOnce([]);
    expect((await importUrl()).statusCode).toBe(400);
  });

  it('cancels stalled DNS at the overall deadline and admits a subsequent import', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let rejectDns: (error: Error) => void = () => {};
    dns.resolve4.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDns = reject; }));
    dns.cancel.mockImplementation(() => rejectDns(new Error('cancelled')));
    const pending = importUrl();
    await flushRequest();
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).statusCode).toBe(400);
    expect(dns.cancel).toHaveBeenCalled();
    vi.useRealTimers();
    expect((await importUrl()).statusCode).toBe(201);
  });

  it('rejects excess concurrent imports and releases capacity after failure', async () => {
    replyUpstream = () => response(Buffer.alloc(0), {}, 200, false);
    const pending = Array.from({ length: 4 }, () => importUrl());
    await flushRequest();
    expect((await importUrl()).statusCode).toBe(429);
    for (const stream of responses) stream.destroy(new Error('upstream reset'));
    expect((await Promise.all(pending)).map((result) => result.statusCode)).toEqual([400, 400, 400, 400]);
    replyUpstream = () => response();
    expect((await importUrl()).statusCode).toBe(201);
  });
});
