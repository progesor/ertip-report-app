import type {
  OdooCurrencyCodeInput,
  SaleOrderSyncBatch,
} from '@ertip/db';
import type { OdooClient } from '@ertip/odoo-client';

import {
  runSaleOrderSync as runBaseSaleOrderSync,
  type SaleOrderSyncStore,
} from './sale-order-sync.ts';

const CURRENCY_FIELDS = ['id', 'name'] as const;

type OdooRecord = Readonly<Record<string, unknown>>;

function readCurrencyId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function readCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
}

export async function readOdooCurrencyCodes(
  client: OdooClient,
): Promise<readonly OdooCurrencyCodeInput[]> {
  const records = await client.call<readonly OdooRecord[]>('res.currency', 'search_read', {
    domain: [],
    fields: CURRENCY_FIELDS,
    order: 'id asc',
    limit: 500,
    context: { active_test: false },
    load: null,
  });

  return records.flatMap((record) => {
    const odooCurrencyId = readCurrencyId(record.id);
    const code = readCurrencyCode(record.name);

    return odooCurrencyId === null || code === null ? [] : [{ odooCurrencyId, code }];
  });
}

export async function runSaleOrderSync(
  input: Parameters<typeof runBaseSaleOrderSync>[0],
): ReturnType<typeof runBaseSaleOrderSync> {
  const currencyCodes = await readOdooCurrencyCodes(input.client);
  let pendingCurrencyCodes = currencyCodes;
  const wrappedStore: SaleOrderSyncStore = {
    ...input.store,
    async applySaleOrderSyncBatch(runId, batch, cursorSourceId) {
      const enrichedBatch =
        pendingCurrencyCodes.length === 0
          ? batch
          : ({
              ...batch,
              currencyCodes: pendingCurrencyCodes,
            } as SaleOrderSyncBatch);
      pendingCurrencyCodes = [];
      await input.store.applySaleOrderSyncBatch(runId, enrichedBatch, cursorSourceId);
    },
  };

  return runBaseSaleOrderSync({
    ...input,
    store: wrappedStore,
  });
}
