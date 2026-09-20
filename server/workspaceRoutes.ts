import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { readCookies } from './cookies.ts';
import type { AccountsOptions } from './auth/routes.ts';
import type { AuditService } from './audit.ts';
import { SESSION_COOKIE_NAME } from './session.ts';
import { WorkspaceError, WorkspaceService, type ShareRole } from './workspace.ts';

export type AiGatewayConfig = {
  enabled: boolean;
  apiKey?: string;
  provider: string;
  baseUrl: string;
  model: string;
  maxRequestsPerHour: number;
};

const AI_PROVIDER_TIMEOUT_MS = 120_000;

export const AI_PROVIDER_OPTIONS = [
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4.1-mini'],
    capabilities: ['streaming'],
  },
  {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    capabilities: ['streaming'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
    capabilities: ['streaming'],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    models: ['llama3.2', 'qwen2.5'],
    capabilities: ['streaming'],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest', 'mistral-large-latest'],
    capabilities: ['streaming'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    capabilities: ['streaming'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash'],
    capabilities: ['streaming'],
  },
] as const;

function providerOption(provider: string) {
  return AI_PROVIDER_OPTIONS.find((option) => option.id === provider) ?? AI_PROVIDER_OPTIONS[0];
}

function resolveAiBaseUrl(provider: string, config: AiGatewayConfig, preferenceBaseUrl: string | null) {
  const configHasCatalogProvider = AI_PROVIDER_OPTIONS.some((option) => option.id === config.provider);
  if (provider === config.provider || (!configHasCatalogProvider && provider === 'openai-compatible')) {
    return preferenceBaseUrl ?? config.baseUrl;
  }
  return providerOption(provider).defaultBaseUrl;
}

const documentIdParams = z.object({ documentId: z.string().uuid() });
const shareParams = z.object({ documentId: z.string().uuid(), shareId: z.string().uuid() });
const commentParams = z.object({ commentId: z.string().uuid() });
const metadataBody = z.object({
  folder: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(50)).max(30).optional(),
  isStarred: z.boolean().optional(),
});
const bulkBody = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  folder: z.string().max(120).nullable().optional(),
  isStarred: z.boolean().optional(),
});
const shareBody = z.object({ email: z.string().email().max(320), role: z.enum(['viewer', 'editor']).default('viewer') });
const commentBody = z.object({ body: z.string().min(1).max(10_000), paraId: z.string().max(128).nullable().optional(), parentId: z.string().uuid().nullable().optional() });
const resolveBody = z.object({ resolved: z.boolean() });
const tokenBody = z.object({ name: z.string().max(80).default('API token'), expiresAt: z.string().datetime().nullable().optional() });
const tokenParams = z.object({ tokenId: z.string().uuid() });
const aiSettingsBody = z.object({ provider: z.string().min(1).max(80).optional(), model: z.string().min(1).max(160).optional(), baseUrl: z.string().url().nullable().optional(), enabled: z.boolean().optional() });
const aiBody = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(20_000) })).min(1).max(24),
  context: z.object({ selection: z.string().max(20_000).optional(), paragraph: z.string().max(20_000).optional(), documentName: z.string().max(255).optional() }).optional(),
});

async function requireSession(request: FastifyRequest, reply: FastifyReply, accounts: AccountsOptions) {
  const session = await accounts.sessions.resolve(readCookies(request.headers.cookie)[SESSION_COOKIE_NAME]);
  if (!session) {
    void reply.code(401).send({ message: 'A session is required.' });
    return null;
  }
  return session;
}

function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) throw new WorkspaceError('Request validation failed.', 400);
  return result.data;
}

function writeEvent(reply: FastifyReply, payload: unknown) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

type StreamChunk = { text?: string; done?: boolean };

function openEventStream(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
}

async function pipeEventStream(
  reply: FastifyReply,
  response: Response,
  parseChunk: (data: string) => StreamChunk,
) {
  openEventStream(reply);
  const finish = () => {
    if (reply.raw.writableEnded) return;
    writeEvent(reply, { type: 'done' });
    reply.raw.end();
  };

  if (!response.body) {
    finish();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const consume = (line: string) => {
    if (!line.startsWith('data:')) return false;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      finish();
      return true;
    }
    try {
      const chunk = parseChunk(data);
      if (chunk.text) writeEvent(reply, { type: 'text', text: chunk.text });
      if (chunk.done) {
        finish();
        return true;
      }
    } catch {
      // Providers may split JSON across chunks; the next read completes it.
    }
    return false;
  };

  while (true) {
    const chunk = await reader.read();
    pending += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (consume(line)) return;
    }
    if (chunk.done) {
      if (pending.trim()) consume(`data: ${pending.trim()}`);
      break;
    }
  }
  finish();
}

async function streamOpenAiCompatible(
  reply: FastifyReply,
  config: AiGatewayConfig,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new WorkspaceError(`AI provider returned ${response.status}.`, 502);
  }
  await pipeEventStream(reply, response, (data) => {
    const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    return { text: payload.choices?.[0]?.delta?.content };
  });
}

async function streamAnthropic(
  reply: FastifyReply,
  config: AiGatewayConfig,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const system = messages.find((message) => message.role === 'system')?.content;
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      ...(system ? { system } : {}),
      messages: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })),
    }),
    signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) throw new WorkspaceError(`AI provider returned ${response.status}.`, 502);
  await pipeEventStream(reply, response, (data) => {
    const payload = JSON.parse(data) as { type?: string; delta?: { text?: string } };
    return { text: payload.delta?.text, done: payload.type === 'message_stop' };
  });
}

async function streamGemini(
  reply: FastifyReply,
  config: AiGatewayConfig,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const versionedBaseUrl = baseUrl.endsWith('/v1beta') ? baseUrl : `${baseUrl}/v1beta`;
  const endpoint = `${versionedBaseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey ?? '')}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
    }),
    signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) throw new WorkspaceError(`AI provider returned ${response.status}.`, 502);
  await pipeEventStream(reply, response, (data) => {
    const payload = JSON.parse(data) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { text: payload.candidates?.[0]?.content?.parts?.[0]?.text };
  });
}

async function streamAiProvider(
  reply: FastifyReply,
  config: AiGatewayConfig,
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  switch (providerOption(provider).protocol) {
    case 'anthropic':
      await streamAnthropic(reply, config, model, messages);
      return;
    case 'gemini':
      await streamGemini(reply, config, model, messages);
      return;
    default:
      await streamOpenAiCompatible(reply, config, model, messages);
  }
}

export function registerWorkspaceRoutes(
  app: FastifyInstance,
  options: { accounts: AccountsOptions; workspace: WorkspaceService; ai: AiGatewayConfig; audit?: AuditService; quotas?: { maxDocuments: number; maxStorageBytes: number } },
) {
  const { accounts, workspace, ai, quotas } = options;

  app.get('/api/public/documents', async (request, reply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const userId = token ? await workspace.resolveApiToken(token) : null;
    if (!userId) return reply.code(401).send({ message: 'A valid bearer token is required.' });
    return workspace.listDocuments(userId);
  });

  app.get('/api/workspace/documents', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const query = request.query as { q?: string; folder?: string; tag?: string; starred?: string };
    return workspace.listDocuments(session.user.id, {
      query: query.q,
      folder: query.folder,
      tag: query.tag,
      starred: query.starred === undefined ? undefined : query.starred === 'true',
    });
  });

  app.get('/api/workspace/usage', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return { ...(await workspace.usage(session.user.id)), limits: quotas ?? null };
  });

  app.patch('/api/workspace/documents/:documentId', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.updateMetadata(
      session.user.id,
      parse(documentIdParams, request.params).documentId,
      parse(metadataBody, request.body),
    );
  });

  app.post('/api/workspace/documents/bulk', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const body = parse(bulkBody, request.body);
    return workspace.bulkUpdate(session.user.id, body.documentIds, body);
  });

  app.get('/api/workspace/documents/:documentId/shares', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.listShares(session.user.id, parse(documentIdParams, request.params).documentId);
  });

  app.post('/api/workspace/documents/:documentId/shares', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const params = parse(documentIdParams, request.params);
    const body = parse(shareBody, request.body);
    return workspace.upsertShare(session.user.id, params.documentId, body.email, body.role as ShareRole);
  });

  app.delete('/api/workspace/documents/:documentId/shares/:shareId', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const params = parse(shareParams, request.params);
    await workspace.deleteShare(session.user.id, params.documentId, params.shareId);
    return reply.code(204).send();
  });

  app.get('/api/workspace/documents/:documentId/comments', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.listComments(session.user.id, parse(documentIdParams, request.params).documentId);
  });

  app.post('/api/workspace/documents/:documentId/comments', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const params = parse(documentIdParams, request.params);
    return reply.code(201).send(await workspace.addComment(session.user.id, params.documentId, parse(commentBody, request.body)));
  });

  app.patch('/api/workspace/comments/:commentId', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.resolveComment(session.user.id, parse(commentParams, request.params).commentId, parse(resolveBody, request.body).resolved);
  });

  app.get('/api/workspace/notifications', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.listNotifications(session.user.id);
  });

  app.post('/api/workspace/notifications/read', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const body = parse(z.object({ ids: z.array(z.string().uuid()).optional() }), request.body ?? {});
    await workspace.markNotificationsRead(session.user.id, body.ids);
    return reply.code(204).send();
  });

  app.get('/api/account/tokens', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    return workspace.listApiTokens(session.user.id);
  });

  app.post('/api/account/tokens', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const body = parse(tokenBody, request.body);
    return reply.code(201).send(await workspace.createApiToken(session.user.id, body.name, body.expiresAt ? new Date(body.expiresAt) : null));
  });

  app.delete('/api/account/tokens/:tokenId', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    await workspace.revokeApiToken(session.user.id, parse(tokenParams, request.params).tokenId);
    return reply.code(204).send();
  });

  app.get('/api/ai/settings', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const [preference, usage] = await Promise.all([workspace.getAiPreference(session.user.id), workspace.aiUsage(session.user.id)]);
    const provider = preference.provider || ai.provider;
    return {
      enabled: ai.enabled && preference.enabled,
      provider,
      model: preference.model || ai.model,
      baseUrl: resolveAiBaseUrl(provider, ai, preference.baseUrl),
      providers: AI_PROVIDER_OPTIONS,
      keySource: 'operator-env',
      apiKeyConfigured: Boolean(ai.apiKey),
      usage,
      maxRequestsPerHour: ai.maxRequestsPerHour,
    };
  });

  app.patch('/api/ai/settings', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const input = parse(aiSettingsBody, request.body);
    const preference = await workspace.updateAiPreference(session.user.id, {
      ...input,
      // Endpoints stay operator-owned; a null preference selects the catalog
      // default for the chosen provider without carrying an old provider URL.
      baseUrl: null,
    });
    const provider = preference.provider || ai.provider;
    return {
      provider,
      model: preference.model,
      baseUrl: resolveAiBaseUrl(provider, ai, preference.baseUrl),
      enabled: ai.enabled && preference.enabled,
      providers: AI_PROVIDER_OPTIONS,
    };
  });

  app.post('/api/ai/chat', async (request, reply) => {
    const session = await requireSession(request, reply, accounts);
    if (!session) return reply;
    const body = parse(aiBody, request.body);
    const preference = await workspace.getAiPreference(session.user.id);
    if (!ai.enabled || !ai.apiKey || !preference.enabled) throw new WorkspaceError('AI is disabled. Configure an operator key and enable AI first.', 503);
    await workspace.consumeAiQuota(session.user.id, ai.maxRequestsPerHour);
    const context = body.context
      ? `\nDocument: ${body.context.documentName ?? 'Untitled'}\nSelection: ${body.context.selection ?? '(none)'}\nParagraph: ${body.context.paragraph ?? '(none)'}`
      : '';
    const messages = [
      { role: 'system', content: `You are the DocxCraft Editor assistant. Be concise, preserve the user's intent, and never claim to have changed the document unless a client tool did it.${context}` },
      ...body.messages,
    ];
    await options.audit?.record({ action: 'ai.chat', actorUserId: session.user.id, ip: request.ip });
    try {
      const provider = preference.provider || ai.provider;
      const config = { ...ai, baseUrl: resolveAiBaseUrl(provider, ai, preference.baseUrl) };
      await streamAiProvider(reply, config, provider, preference.model || ai.model, messages);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('The AI provider could not be reached.', 502);
    }
  });
}
