import { Pool } from 'pg';

export interface PromoRule {
  id: number;
  code: string;
  discountRate: number;
  active: boolean;
  createdAt: Date;
}

export interface CreatePromoInput {
  code: string;
  discountRate: number;
  active?: boolean;
}

interface PromoRow {
  id: number;
  code: string;
  discount_rate: string;
  active: boolean;
  created_at: Date;
}

function mapPromoRow(row: PromoRow): PromoRule {
  return {
    id: row.id,
    code: row.code,
    // node-postgres returns SQL NUMERIC as string to preserve arbitrary precision
    discountRate: Number(row.discount_rate),
    active: row.active,
    createdAt: row.created_at,
  };
}

/**
 * Creates a pg Pool configured from DATABASE_URL or explicit connection string.
 */
export function createPromoPool(connectionString?: string): Pool {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required for PromoRepository');
  }
  return new Pool({ connectionString: url });
}

/**
 * PostgreSQL persistence layer for promotional discount rules.
 */
export class PromoRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently provisions the promos table and constraints.
   */
  public async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS promos (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        discount_rate NUMERIC(5, 4) NOT NULL CHECK (discount_rate >= 0 AND discount_rate <= 1),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  /**
   * Inserts a new promotional rule (code normalized to uppercase).
   */
  public async createPromo(input: CreatePromoInput): Promise<PromoRule> {
    const normalizedCode = input.code.trim().toUpperCase();
    const active = input.active ?? true;

    const result = await this.pool.query<PromoRow>(
      `
      INSERT INTO promos (code, discount_rate, active)
      VALUES ($1, $2, $3)
      RETURNING id, code, discount_rate, active, created_at;
      `,
      [normalizedCode, input.discountRate, active],
    );

    return mapPromoRow(result.rows[0]);
  }

  /**
   * Returns all active promotional rules ordered by creation id.
   */
  public async getActivePromos(): Promise<PromoRule[]> {
    const result = await this.pool.query<PromoRow>(
      `
      SELECT id, code, discount_rate, active, created_at
      FROM promos
      WHERE active = TRUE
      ORDER BY id ASC;
      `,
    );

    return result.rows.map(mapPromoRow);
  }

  /**
   * Looks up a single active promotional rule by code.
   */
  public async findActiveByCode(code: string): Promise<PromoRule | null> {
    const normalizedCode = code.trim().toUpperCase();
    const result = await this.pool.query<PromoRow>(
      `
      SELECT id, code, discount_rate, active, created_at
      FROM promos
      WHERE code = $1 AND active = TRUE
      LIMIT 1;
      `,
      [normalizedCode],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapPromoRow(result.rows[0]);
  }

  /**
   * Resets table state and SERIAL identity counters for deterministic test isolation.
   */
  public async truncate(): Promise<void> {
    await this.pool.query('TRUNCATE TABLE promos RESTART IDENTITY CASCADE;');
  }
}
