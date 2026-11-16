import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PricingEngine, PricingItem } from '../src/pricing-engine.js';
import { createPromoPool, PromoRepository } from '../src/promo-repository.js';

describe('PricingEngine + PromoRepository Integration Tests (Shard 2)', () => {
  let pool: Pool;
  let repo: PromoRepository;
  const engine = new PricingEngine('USD');

  before(async () => {
    pool = createPromoPool();
    repo = new PromoRepository(pool);
    await repo.ensureSchema();
  });

  beforeEach(async () => {
    await repo.truncate();
  });

  after(async () => {
    await pool.end();
  });

  it('should apply an active PostgreSQL promo code on top of volume discounts', async () => {
    await repo.createPromo({ code: 'LAUNCH15', discountRate: 0.15, active: true });

    const promo = await repo.findActiveByCode('launch15');
    assert.ok(promo, 'Expected LAUNCH15 promo to exist in Postgres');

    const items: PricingItem[] = [
      { id: '1', name: 'Cloud Node', unitPrice: 100, quantity: 10 }, // subtotal 1000, 5% volume + 15% promo = 20%
    ];

    const quote = engine.generateQuoteWithPromo(items, 0.1, promo.discountRate, 'USD');
    assert.equal(quote.subtotal, 1000);
    assert.equal(quote.discountAmount, 200);
    assert.equal(quote.taxAmount, 80);
    assert.equal(quote.total, 880);
  });

  it('should ignore inactive promotional rules persisted in PostgreSQL', async () => {
    await repo.createPromo({ code: 'EXPIRED50', discountRate: 0.5, active: false });

    const promo = await repo.findActiveByCode('EXPIRED50');
    assert.equal(promo, null);

    const items: PricingItem[] = [
      { id: '1', name: 'Edge Router', unitPrice: 200, quantity: 2 }, // subtotal 400, 0% volume
    ];

    const quote = engine.generateQuoteWithPromo(items, 0.1, 0, 'USD');
    assert.equal(quote.discountAmount, 0);
    assert.equal(quote.taxAmount, 40);
    assert.equal(quote.total, 440);
  });
});
