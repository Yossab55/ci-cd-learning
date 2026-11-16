import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createPromoPool, PromoRepository } from '../src/promo-repository.js';

describe('PromoRepository PostgreSQL Integration Tests (Shard 1)', () => {
  let pool: Pool;
  let repo: PromoRepository;

  before(async () => {
    pool = createPromoPool();
    repo = new PromoRepository(pool);
    await repo.ensureSchema();
  });

  beforeEach(async () => {
    // Guarantee sterile DB state regardless of previous test outcome or execution order
    await repo.truncate();
  });

  after(async () => {
    await pool.end();
  });

  it('should insert SUMMER20 and convert SQL NUMERIC cleanly to JS number', async () => {
    const created = await repo.createPromo({
      code: 'summer20',
      discountRate: 0.2,
    });

    assert.equal(created.id, 1);
    assert.equal(created.code, 'SUMMER20');
    assert.equal(created.discountRate, 0.2);
    assert.equal(typeof created.discountRate, 'number');
    assert.equal(created.active, true);
  });

  it('should return an empty array immediately after SUMMER20 test due to beforeEach TRUNCATE isolation', async () => {
    const active = await repo.getActivePromos();
    assert.deepEqual(active, []);
  });

  it('should enforce PostgreSQL UNIQUE constraint on duplicate promo codes (23505)', async () => {
    await repo.createPromo({ code: 'VIP15', discountRate: 0.15 });

    await assert.rejects(
      () => repo.createPromo({ code: 'vip15', discountRate: 0.25 }),
      (err: unknown) => {
        const pgErr = err as { code?: string };
        return pgErr.code === '23505';
      },
    );
  });

  it('should enforce PostgreSQL CHECK constraint on out-of-range discount_rate (23514)', async () => {
    await assert.rejects(
      () => repo.createPromo({ code: 'INVALID200', discountRate: 1.5 }),
      (err: unknown) => {
        const pgErr = err as { code?: string };
        return pgErr.code === '23514';
      },
    );
  });
});
