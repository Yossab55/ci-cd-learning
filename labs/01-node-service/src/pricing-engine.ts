export type Currency = 'USD' | 'EUR' | 'EGP';

export interface PricingItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PricingQuote {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  currency: Currency;
}

export class PricingEngine {
  constructor(private defaultCurrency: Currency = 'USD') {}

  /**
   * Calculates subtotal of items
   */
  public calculateSubtotal(items: PricingItem[]): number {
    if (!items || items.length === 0) return 0;
    
    return items.reduce((sum, item) => {
      if (item.unitPrice < 0 || item.quantity < 0) {
        throw new Error(`Invalid item: price and quantity must be non-negative (received: ${item.unitPrice}, ${item.quantity})`);
      }
      return sum + item.unitPrice * item.quantity;
    }, 0);
  }

  /**
   * Calculates volume discount based on total quantity
   * 1-9 items: 0%
   * 10-49 items: 5%
   * 50+ items: 10%
   */
  public calculateDiscountRate(totalQuantity: number): number {
    if (totalQuantity >= 50) return 0.10;
    if (totalQuantity >= 10) return 0.05;
    return 0.0;
  }

  /**
   * Generates a final deterministic pricing quote
   */
  public generateQuote(items: PricingItem[], taxRate: number, currency?: Currency): PricingQuote {
    return this.generateQuoteWithPromo(items, taxRate, 0, currency);
  }

  /**
   * Generates a deterministic pricing quote with an optional promotional discount rate
   * combined with volume discounts (capped at 100%).
   */
  public generateQuoteWithPromo(
    items: PricingItem[],
    taxRate: number,
    promoRate: number = 0,
    currency?: Currency,
  ): PricingQuote {
    if (taxRate < 0 || taxRate > 1) {
      throw new Error(`Invalid tax rate: must be between 0.0 and 1.0 (received: ${taxRate})`);
    }
    if (promoRate < 0 || promoRate > 1) {
      throw new Error(`Invalid promo rate: must be between 0.0 and 1.0 (received: ${promoRate})`);
    }

    const subtotal = this.calculateSubtotal(items);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const volumeRate = this.calculateDiscountRate(totalQuantity);
    const effectiveDiscountRate = Math.min(1, volumeRate + promoRate);
    const discountAmount = Number((subtotal * effectiveDiscountRate).toFixed(2));
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = Number((taxableAmount * taxRate).toFixed(2));
    const total = Number((taxableAmount + taxAmount).toFixed(2));

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
      currency: currency || this.defaultCurrency,
    };
  }
}
