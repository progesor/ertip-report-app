import type { Pool } from 'pg';

export interface OdooCurrencyCodeInput {
  readonly odooCurrencyId: number;
  readonly code: string;
}

export function getOdooCurrencyCodeMetaKey(odooCurrencyId: number): string {
  return `odoo_currency_code:${odooCurrencyId}`;
}

export async function upsertOdooCurrencyCodes(
  pool: Pool,
  currencies: readonly OdooCurrencyCodeInput[],
): Promise<void> {
  const normalized = [
    ...new Map(
      currencies
        .filter(
          ({ odooCurrencyId, code }) =>
            Number.isSafeInteger(odooCurrencyId) &&
            odooCurrencyId > 0 &&
            /^[A-Z]{3}$/u.test(code.trim().toUpperCase()),
        )
        .map(({ odooCurrencyId, code }) => [
          odooCurrencyId,
          { odoo_currency_id: odooCurrencyId, code: code.trim().toUpperCase() },
        ]),
    ).values(),
  ];

  if (normalized.length === 0) {
    return;
  }

  await pool.query(
    `INSERT INTO app_meta (key, value, updated_at)
     SELECT
       'odoo_currency_code:' || value.odoo_currency_id::text,
       value.code,
       now()
     FROM jsonb_to_recordset($1::jsonb) AS value(
       odoo_currency_id integer,
       code text
     )
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now()`,
    [JSON.stringify(normalized)],
  );
}
