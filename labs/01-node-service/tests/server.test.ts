import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { createAppServer } from '../src/index.js';

describe('Pricing Service HTTP Server Unit Tests', () => {
  it('GET /health returns 200 when PostgreSQL query succeeds', async () => {
    const server = createAppServer({
      pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) },
      promoRepo: { findActiveByCode: async () => null },
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    after(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await response.json()) as { status: string; database: string };

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
  });

  it('GET /health returns 503 when PostgreSQL query fails', async () => {
    const server = createAppServer({
      pool: {
        query: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
      promoRepo: { findActiveByCode: async () => null },
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    after(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await response.json()) as { status: string; database: string };

    assert.equal(response.status, 503);
    assert.equal(body.status, 'error');
    assert.equal(body.database, 'disconnected');
  });

  it('POST /quote computes deterministic quote JSON', async () => {
    const server = createAppServer({
      pool: { query: async () => ({ rows: [] }) },
      promoRepo: { findActiveByCode: async () => null },
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    after(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: '1', name: 'Widget', unitPrice: 100, quantity: 10 }],
        taxRate: 0.1,
        currency: 'USD',
      }),
    });
    const quote = (await response.json()) as { total: number; discountAmount: number };

    assert.equal(response.status, 200);
    assert.equal(quote.discountAmount, 50);
    assert.equal(quote.total, 1045);
  });
});
