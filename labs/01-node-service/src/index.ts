import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import { Currency, PricingEngine, PricingItem } from './pricing-engine.js';
import { createPromoPool, PromoRepository } from './promo-repository.js';

export interface HealthQueryPool {
  query(sql: string): Promise<unknown>;
}

export interface ServerDependencies {
  pool: HealthQueryPool;
  promoRepo: Pick<PromoRepository, 'findActiveByCode'>;
  pricingEngine?: PricingEngine;
}

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request payload too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw.length > 0 ? JSON.parse(raw) : {};
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new Error('Request body must be a JSON object'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Builds the HTTP server with deep PostgreSQL health probing and quote calculation.
 */
export function createAppServer(deps: ServerDependencies): Server {
  const engine = deps.pricingEngine ?? new PricingEngine('USD');

  return createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const urlPath = (req.url ?? '/').split('?')[0];

    if (method === 'GET' && urlPath === '/health') {
      try {
        await deps.pool.query('SELECT 1');
        sendJson(res, 200, {
          status: 'ok',
          service: 'pricing-service',
          database: 'connected',
        });
      } catch {
        sendJson(res, 503, {
          status: 'error',
          service: 'pricing-service',
          database: 'disconnected',
        });
      }
      return;
    }

    if (method === 'POST' && urlPath === '/quote') {
      try {
        const body = await readJsonBody(req);
        if (!Array.isArray(body.items) || typeof body.taxRate !== 'number') {
          sendJson(res, 400, { error: 'items (array) and taxRate (number) are required' });
          return;
        }

        let promoRate = 0;
        if (typeof body.promoCode === 'string' && body.promoCode.trim().length > 0) {
          const promo = await deps.promoRepo.findActiveByCode(body.promoCode);
          if (!promo) {
            sendJson(res, 404, { error: `Active promo code not found: ${body.promoCode}` });
            return;
          }
          promoRate = promo.discountRate;
        }

        const currency = typeof body.currency === 'string' ? (body.currency as Currency) : undefined;
        const quote = engine.generateQuoteWithPromo(
          body.items as PricingItem[],
          body.taxRate,
          promoRate,
          currency,
        );
        sendJson(res, 200, quote);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bad request';
        sendJson(res, 400, { error: message });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  });
}

/**
 * Boots the pricing-service container process and ensures PostgreSQL schema readiness.
 */
export async function startServer(): Promise<{ server: Server; pool: Pool }> {
  const port = Number(process.env.PORT ?? 3000);
  const pool = createPromoPool();
  const promoRepo = new PromoRepository(pool);

  await promoRepo.ensureSchema();

  const server = createAppServer({ pool, promoRepo });
  await new Promise<void>((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`pricing-service listening on http://0.0.0.0:${port}`);
      resolve();
    });
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  return { server, pool };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start pricing-service:', err);
    process.exit(1);
  });
}
