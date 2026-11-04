import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingEngine, PricingItem } from '../src/pricing-engine.js';

describe('PricingEngine Unit Tests (Sub-Second Memory Tests)', () => {
  const engine = new PricingEngine('USD');

  it('should return 0 subtotal for an empty item array', () => {
    const subtotal = engine.calculateSubtotal([]);
    assert.equal(subtotal, 0);
  });

  it('should correctly sum item subtotals', () => {
    const items: PricingItem[] = [
      { id: '1', name: 'Widget', unitPrice: 20, quantity: 2 },
      { id: '2', name: 'Gadget', unitPrice: 15, quantity: 4 },
    ];
    // 20*2 + 15*4 = 40 + 60 = 100
    const subtotal = engine.calculateSubtotal(items);
    assert.equal(subtotal, 100);
  });

  it('should throw error on negative price or quantity', () => {
    const items: PricingItem[] = [
      { id: '1', name: 'Corrupt Item', unitPrice: -5, quantity: 1 }
    ];
    assert.throws(() => engine.calculateSubtotal(items), /Invalid item/);
  });

  it('should apply 5% discount for 10-49 items', () => {
    assert.equal(engine.calculateDiscountRate(10), 0.05);
    assert.equal(engine.calculateDiscountRate(49), 0.05);
  });

  it('should apply 10% discount for 50+ items', () => {
    assert.equal(engine.calculateDiscountRate(50), 0.10);
    assert.equal(engine.calculateDiscountRate(100), 0.10);
  });

  it('should calculate complete pricing quote accurately with discount and tax', () => {
    const items: PricingItem[] = [
      { id: '1', name: 'Server Rack', unitPrice: 100, quantity: 10 }, // subtotal 1000, 10 qty = 5% discount
    ];
    // subtotal = 1000
    // discount = 50 (taxable = 950)
    // tax (10% = 0.10) = 95
    // total = 1045
    const quote = engine.generateQuote(items, 0.10, 'USD');

    assert.equal(quote.subtotal, 1000);
    assert.equal(quote.discountAmount, 50);
    assert.equal(quote.taxAmount, 95);
    assert.equal(quote.total, 1045);
    assert.equal(quote.currency, 'USD');
  });

  it('should throw error when taxRate is outside 0.0 to 1.0 range', () => {
    assert.throws(() => engine.generateQuote([], 1.5), /Invalid tax rate/);
    assert.throws(() => engine.generateQuote([], -0.1), /Invalid tax rate/);
  });
});
