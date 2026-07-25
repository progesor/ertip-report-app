import type { Pool } from 'pg';

import {
  upsertOdooCurrencyCodes,
  type OdooCurrencyCodeInput,
} from './currency-code-database.ts';
import {
  SyncDatabase as BaseSyncDatabase,
  type SaleOrderSyncBatch,
} from './sync-database.ts';

interface CurrencyAwareSaleOrderSyncBatch extends SaleOrderSyncBatch {
  readonly currencyCodes?: readonly OdooCurrencyCodeInput[];
}

export class SyncDatabase extends BaseSyncDatabase {
  public constructor(private readonly currencyPool: Pool) {
    super(currencyPool);
  }

  public override async applySaleOrderSyncBatch(
    runId: string,
    batch: SaleOrderSyncBatch,
    cursorSourceId: number,
  ): Promise<void> {
    const currencyCodes = (batch as CurrencyAwareSaleOrderSyncBatch).currencyCodes ?? [];
    await upsertOdooCurrencyCodes(this.currencyPool, currencyCodes);
    await super.applySaleOrderSyncBatch(runId, batch, cursorSourceId);
  }
}
