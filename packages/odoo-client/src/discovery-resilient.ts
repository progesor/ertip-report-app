import { OdooClientError, type OdooClient } from './client.ts';
import {
  discoverOdooTenant as discoverOdooTenantBase,
  type TenantDiscoveryResult,
  type TenantDiscoveryStateCount,
} from './discovery.ts';

const RETRYABLE_ERROR_CODES = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'RATE_LIMITED',
  'ODOO_UNAVAILABLE',
]);

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readStateCountWithRetry(
  client: OdooClient,
  stateValue: string,
): Promise<number | null> {
  const maximumAttempts = 3;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await client.call<number>('sale.order', 'search_count', {
        domain: [['state', '=', stateValue]],
      });
    } catch (error) {
      if (!(error instanceof OdooClientError)) {
        throw error;
      }

      const canRetry = RETRYABLE_ERROR_CODES.has(error.code) && attempt < maximumAttempts;

      if (!canRetry) {
        return null;
      }

      await wait(150 * attempt);
    }
  }

  return null;
}

export async function repairTenantDiscoveryStateCounts(
  client: OdooClient,
  result: TenantDiscoveryResult,
): Promise<readonly TenantDiscoveryStateCount[]> {
  const repairedCounts: TenantDiscoveryStateCount[] = [];

  for (const state of result.saleOrder.stateCounts) {
    if (state.count !== null) {
      repairedCounts.push(state);
      continue;
    }

    repairedCounts.push({
      ...state,
      count: await readStateCountWithRetry(client, state.value),
    });
  }

  return repairedCounts;
}

export async function discoverOdooTenant(client: OdooClient): Promise<TenantDiscoveryResult> {
  const result = await discoverOdooTenantBase(client);
  const hasIncompleteStateCounts = result.saleOrder.stateCounts.some(({ count }) => count === null);

  if (!hasIncompleteStateCounts) {
    return result;
  }

  const stateCounts = await repairTenantDiscoveryStateCounts(client, result);

  return {
    ...result,
    saleOrder: {
      ...result.saleOrder,
      stateCounts,
    },
  };
}
