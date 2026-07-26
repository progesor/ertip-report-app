import { normalizeQuotationStatus, type NormalizedQuotationStatus } from './metrics.ts';

export interface CurrencyAmountSourceRecord {
  readonly id: number;
  readonly state: string;
  readonly validityDate?: string | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface CurrencyAmountMetrics {
  readonly currencyCode: string;
  readonly quotationAmount: string;
  readonly realizedAmount: string;
  readonly openAmount: string;
  readonly notRealizedAmount: string;
  readonly expiredAmount: string;
  readonly cancelledAmount: string;
  readonly unknownAmount: string;
  readonly amountConversionRate: number | null;
}

export interface DecimalAmountChange {
  readonly absolute: string;
  readonly percent: number | null;
}

interface ParsedDecimal {
  readonly units: bigint;
  readonly scale: number;
}

const decimalPattern = /^-?\d+(?:\.\d+)?$/u;

function parseDecimal(value: string): ParsedDecimal {
  const normalized = value.trim();
  if (!decimalPattern.test(normalized)) {
    throw new Error('INVALID_DECIMAL_AMOUNT');
  }

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const units = BigInt(`${whole}${fraction}` || '0') * (negative ? -1n : 1n);
  return { units, scale: fraction.length };
}

function scaleFactor(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function rescale(value: ParsedDecimal, scale: number): bigint {
  return value.units * scaleFactor(scale - value.scale);
}

function formatDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const factor = scaleFactor(scale);
  const whole = absolute / factor;
  const fraction = scale === 0 ? '' : (absolute % factor).toString().padStart(scale, '0').replace(/0+$/u, '');
  const formatted = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative && formatted !== '0' ? `-${formatted}` : formatted;
}

export function sumDecimalAmounts(values: readonly string[]): string {
  if (values.length === 0) {
    return '0';
  }

  const parsed = values.map(parseDecimal);
  const scale = Math.max(...parsed.map(({ scale: candidate }) => candidate));
  const units = parsed.reduce((sum, value) => sum + rescale(value, scale), 0n);
  return formatDecimal(units, scale);
}

export function subtractDecimalAmounts(left: string, right: string): string {
  const parsedLeft = parseDecimal(left);
  const parsedRight = parseDecimal(right);
  const scale = Math.max(parsedLeft.scale, parsedRight.scale);
  return formatDecimal(rescale(parsedLeft, scale) - rescale(parsedRight, scale), scale);
}

export function medianDecimalAmounts(values: readonly string[]): string {
  if (values.length === 0) {
    return '0';
  }

  const parsed = values.map(parseDecimal);
  const scale = Math.max(...parsed.map(({ scale: candidate }) => candidate));
  const sorted = parsed.map((value) => rescale(value, scale)).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0n;
  if (sorted.length % 2 === 1) {
    return formatDecimal(upper, scale);
  }

  const lower = sorted[middle - 1] ?? upper;
  const sum = lower + upper;
  if (sum % 2n === 0n) {
    return formatDecimal(sum / 2n, scale);
  }

  return formatDecimal(sum * 5n, scale + 1);
}

export function calculateDecimalAmountChange(current: string, previous: string): DecimalAmountChange {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);
  return {
    absolute: subtractDecimalAmounts(current, previous),
    percent:
      previousNumber === 0 || !Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)
        ? null
        : (currentNumber - previousNumber) / previousNumber,
  };
}

export function createEmptyCurrencyAmountMetrics(currencyCode: string): CurrencyAmountMetrics {
  return {
    currencyCode,
    quotationAmount: '0',
    realizedAmount: '0',
    openAmount: '0',
    notRealizedAmount: '0',
    expiredAmount: '0',
    cancelledAmount: '0',
    unknownAmount: '0',
    amountConversionRate: null,
  };
}

export function calculateCurrencyAmountMetrics(
  records: readonly CurrencyAmountSourceRecord[],
  asOfDate: Date,
): readonly CurrencyAmountMetrics[] {
  const uniqueRecords = new Map(records.map((record) => [record.id, record]));
  const groups = new Map<string, CurrencyAmountSourceRecord[]>();

  for (const record of uniqueRecords.values()) {
    const currencyCode = record.currencyCode.trim().toUpperCase() || 'XXX';
    groups.set(currencyCode, [...(groups.get(currencyCode) ?? []), record]);
  }

  return [...groups.entries()]
    .map(([currencyCode, currencyRecords]) => {
      const byStatus = new Map<NormalizedQuotationStatus, string[]>();
      for (const status of ['realized', 'open', 'expired', 'cancelled', 'unknown'] as const) {
        byStatus.set(status, []);
      }
      for (const record of currencyRecords) {
        const status = normalizeQuotationStatus(record, asOfDate);
        byStatus.set(status, [...(byStatus.get(status) ?? []), record.amountTotal]);
      }

      const quotationAmount = sumDecimalAmounts(currencyRecords.map(({ amountTotal }) => amountTotal));
      const realizedAmount = sumDecimalAmounts(byStatus.get('realized') ?? []);
      const openAmount = sumDecimalAmounts(byStatus.get('open') ?? []);
      const expiredAmount = sumDecimalAmounts(byStatus.get('expired') ?? []);
      const cancelledAmount = sumDecimalAmounts(byStatus.get('cancelled') ?? []);
      const unknownAmount = sumDecimalAmounts(byStatus.get('unknown') ?? []);
      const notRealizedAmount = sumDecimalAmounts([expiredAmount, cancelledAmount]);
      const quotationNumber = Number(quotationAmount);
      const realizedNumber = Number(realizedAmount);

      return {
        currencyCode,
        quotationAmount,
        realizedAmount,
        openAmount,
        notRealizedAmount,
        expiredAmount,
        cancelledAmount,
        unknownAmount,
        amountConversionRate:
          quotationNumber === 0 || !Number.isFinite(quotationNumber) || !Number.isFinite(realizedNumber)
            ? null
            : realizedNumber / quotationNumber,
      } satisfies CurrencyAmountMetrics;
    })
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}
