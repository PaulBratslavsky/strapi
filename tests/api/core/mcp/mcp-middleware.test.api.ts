import { createStrapiInstance } from 'api-tests/strapi';
import { createAgent } from 'api-tests/agent';
import type { Core } from '@strapi/types';

const MCP_PROTOCOL_VERSION = '2025-06-18';
const UID_MIDDLEWARE = 'global::mcp-test-marker';

/** Records the order in which guards ran, and what they saw. */
const calls: string[] = [];

describe('MCP route middleware (api)', () => {
  let strapi: Core.Strapi;

  beforeAll(async () => {
    strapi = await createStrapiInstance({
      register({ strapi: instance }) {
        instance.config.set('features.future.adminTokens', true);
        instance.config.set('server.mcp.enabled', true);

        // A middleware registered by UID, exactly as an app would ship one.
        instance
          .get('middlewares')
          .set(UID_MIDDLEWARE, (config: any) => async (ctx: any, next: any) => {
            calls.push(`uid:${config?.marker ?? 'none'}`);
            await next();
          });

        instance.ai.mcp.registerMiddlewares([
          async (ctx: any, next: any) => {
            // Runs before the MCP handler, so nothing has been written yet.
            calls.push(`inline:${ctx.method} ${ctx.path} respond=${ctx.respond !== false}`);
            await next();
          },
          UID_MIDDLEWARE,
          { name: UID_MIDDLEWARE, config: { marker: 'configured' } },
        ]);
      },
    });
  });

  afterAll(async () => {
    await strapi.destroy();
  });

  beforeEach(() => {
    calls.length = 0;
  });

  const postMcp = (body: Record<string, unknown>) =>
    createAgent(strapi)({
      url: '/mcp',
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body,
    });

  test('runs registered middleware on POST /mcp, in order, before the handler', async () => {
    // No Authorization header: the MCP handler answers 401. The middlewares
    // still ran, which is precisely what we are asserting — they sit upstream
    // of the handler.
    const res = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'mcp-middleware-test', version: '1.0.0' },
      },
    });

    expect(res.statusCode).toBe(401);
    expect(calls).toStrictEqual(['inline:POST /mcp respond=true', 'uid:none', 'uid:configured']);
  });

  test('does not run registered middleware on the method-not-allowed routes', async () => {
    const res = await createAgent(strapi)({ url: '/mcp', method: 'GET' });

    expect(res.statusCode).toBe(405);
    expect(calls).toStrictEqual([]);
  });

  test('does not run registered middleware on unrelated routes', async () => {
    await createAgent(strapi)({ url: '/_health', method: 'GET' });

    expect(calls).toStrictEqual([]);
  });
});
