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
  });
  if (!response.ok) {
    throw new WorkspaceError(`AI provider returned ${response.status}.`, 502);
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  if (!response.body) {
    writeEvent(reply, { type: 'done' });
    reply.raw.end();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const chunk = await reader.read();
    pending += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        writeEvent(reply, { type: 'done' });
        reply.raw.end();
        return;
      }
      try {
        const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const text = payload.choices?.[0]?.delta?.content;
        if (text) writeEvent(reply, { type: 'text', text });
      } catch {
        // Providers may split JSON across chunks; the next read completes it.
      }
    }
    if (chunk.done) break;
  }
  writeEvent(reply, { type: 'done' });
  reply.raw.end();
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
    return {
      enabled: ai.enabled && preference.enabled,
      provider: preference.provider || ai.provider,
      model: preference.model || ai.model,
      baseUrl: preference.baseUrl ?? ai.baseUrl,
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
      baseUrl: ai.baseUrl,
    });
    return { provider: preference.provider, model: preference.model, baseUrl: preference.baseUrl, enabled: preference.enabled };
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
      await streamOpenAiCompatible(reply, ai, preference.model || ai.model, messages);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('The AI provider could not be reached.', 502);
    }
  });
}
