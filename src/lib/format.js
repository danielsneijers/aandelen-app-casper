/** Nederlandse opmaak, gedeeld door de build en de browser. */

const euro = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * De koers komt met drie decimalen binnen, maar €123,679 leest rommelig.
 * Twee decimalen, net als bij een broker.
 */
const euroPrecise = euro;

const pct = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Aandeel-stukjes: vier decimalen, anders lijkt 0,0971 al snel gewoon 0,1. */
const shares = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const dayMonth = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthYear = new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' });

export const formatEuro = (n) => euro.format(n);
export const formatPrice = (n) => euroPrecise.format(n);
export const formatShares = (n) => shares.format(n);

/** Met expliciet plusteken, zodat winst en verlies even duidelijk zijn. */
export const formatSigned = (n) => (n >= 0 ? '+' : '−') + euro.format(Math.abs(n));
export const formatPct = (n) => (n >= 0 ? '+' : '−') + pct.format(Math.abs(n)) + '%';

/** '2026-07-28' -> Date, als lokale middag zodat tijdzones niets verschuiven. */
const toDate = (iso) => new Date(iso + 'T12:00:00');

export const formatDayMonth = (iso) => dayMonth.format(toDate(iso));
export const formatLongDate = (iso) => dayMonthYear.format(toDate(iso));
export const formatMonthYear = (iso) => monthYear.format(toDate(iso));
