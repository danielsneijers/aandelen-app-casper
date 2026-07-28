/**
 * Controle op het rekenwerk in src/lib/portfolio.js.
 * Draaien met:  npm test
 *
 * Gebruikt een kleine, met de hand na te rekenen koersreeks in plaats van
 * echte data, zodat de uitkomsten niet veranderen als de beurs beweegt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolio, indexOnOrBefore } from '../src/lib/portfolio.js';

// 3 en 4 januari 2026 vallen in het weekend: die ontbreken dus, net als echt.
const prices = {
  dates: ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06'],
  closes: [100, 200, 50, 25],
  price: 25,
};

test('inleg in het weekend gebruikt de laatste beursdag ervoor', () => {
  const { deposits, summary } = computePortfolio(prices, [{ date: '2026-01-03', eur: 100 }]);

  assert.equal(deposits[0].tradingDate, '2026-01-02');
  assert.equal(deposits[0].price, 200);
  assert.equal(deposits[0].shares, 0.5);
  assert.equal(summary.value, 12.5);
  assert.equal(summary.profit, -87.5);
  assert.equal(summary.profitPct, -87.5);
});

test('meerdere inlegmomenten tellen op tegen hun eigen koers', () => {
  const { summary } = computePortfolio(prices, [
    { date: '2026-01-01', eur: 100 }, // 1 stukje tegen 100
    { date: '2026-01-05', eur: 100 }, // 2 stukjes tegen 50
  ]);

  assert.equal(summary.shares, 3);
  assert.equal(summary.invested, 200);
  assert.equal(summary.value, 75);
  assert.equal(summary.sharePct, 300);
});

test('de waardereeks begint bij de eerste inleg en loopt trapsgewijs op', () => {
  const { series } = computePortfolio(prices, [
    { date: '2026-01-01', eur: 100 },
    { date: '2026-01-05', eur: 100 },
  ]);

  assert.equal(series.dates[0], '2026-01-01');
  assert.deepEqual(series.values, [100, 200, 150, 75]);
  assert.deepEqual(series.invested, [100, 100, 200, 200]);
});

test('inleg van vóór onze koersdata wordt overgeslagen', () => {
  const { deposits, summary } = computePortfolio(prices, [
    { date: '2020-01-01', eur: 100 },
    { date: '2026-01-06', eur: 25 },
  ]);

  assert.equal(deposits.length, 1);
  assert.equal(summary.invested, 25);
});

test('onbruikbare bedragen tellen niet mee', () => {
  const { deposits } = computePortfolio(prices, [
    { date: '2026-01-06', eur: 0 },
    { date: '2026-01-06', eur: -5 },
    { date: '2026-01-06', eur: 'appel' },
  ]);

  assert.equal(deposits.length, 0);
});

test('zonder inleg blijft alles op nul en is rendement niet gedefinieerd', () => {
  const { summary, series } = computePortfolio(prices, []);

  assert.equal(summary.value, 0);
  assert.equal(summary.invested, 0);
  assert.equal(summary.profitPct, null);
  assert.deepEqual(series.dates, []);
});

test('indexOnOrBefore vindt de juiste beursdag', () => {
  assert.equal(indexOnOrBefore(prices.dates, '2026-01-05'), 2); // precies raak
  assert.equal(indexOnOrBefore(prices.dates, '2026-01-04'), 1); // zondag -> vrijdag
  assert.equal(indexOnOrBefore(prices.dates, '2019-01-01'), -1); // te vroeg
  assert.equal(indexOnOrBefore(prices.dates, '2030-01-01'), 3); // na het einde
});
