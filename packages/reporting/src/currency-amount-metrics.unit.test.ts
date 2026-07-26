import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCurrencyAmountMetrics,
  calculateDecimalAmountChange,
  medianDecimalAmounts,
  subtractDecimalAmounts,
  sumDecimalAmounts,
} from './currency-amount-metrics.ts';

const asOfDate = new Date('2026-07-26T12:00:00.000Z');

test('adds, subtracts and calculates decimal medians without floating point drift', () => {
  assert.equal(sumDecimalAmounts(['0.1', '0.2', '10.005']), '10.305');
  assert.equal(subtractDecimalAmounts('1000.50', '200.25'), '800.25');
  assert.equal(medianDecimalAmounts(['1.1', '2.2', '3.3']), '2.2');
  assert.equal(medianDecimalAmounts(['1', '2']), '1.5');
  assert.deepEqual(calculateDecimalAmountChange('150', '100'), {
    absolute: '50',
    percent: 0.5,
  });
});

test('keeps source currencies separate and deduplicates records by id', () => {
  const metrics = calculateCurrencyAmountMetrics(
    [
      { id: 1, state: 'sale', validityDate: null, amountTotal: '1000.10', currencyCode: 'usd' },
      { id: 1, state: 'sale', validityDate: null, amountTotal: '1000.10', currencyCode: 'USD' },
      { id: 2, state: 'draft', validityDate: '2026-08-10', amountTotal: '500.20', currencyCode: 'USD' },
      { id: 3, state: 'cancel', validityDate: null, amountTotal: '300', currencyCode: 'EUR' },
      { id: 4, state: 'draft', validityDate: '2026-07-01', amountTotal: '200', currencyCode: 'EUR' },
    ],
    asOfDate,
  );

  assert.deepEqual(metrics.map(({ currencyCode }) => currencyCode), ['EUR', 'USD']);
  const usd = metrics.find(({ currencyCode }) => currencyCode === 'USD');
  assert.equal(usd?.quotationAmount, '1500.3');
  assert.equal(usd?.realizedAmount, '1000.1');
  assert.equal(usd?.openAmount, '500.2');
  assert.equal(usd?.notRealizedAmount, '0');

  const eur = metrics.find(({ currencyCode }) => currencyCode === 'EUR');
  assert.equal(eur?.quotationAmount, '500');
  assert.equal(eur?.expiredAmount, '200');
  assert.equal(eur?.cancelledAmount, '300');
  assert.equal(eur?.notRealizedAmount, '500');
});
