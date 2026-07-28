/**
 * De rekenkunde achter de tracker.
 *
 * Het idee: Casper koopt geen heel aandeel, maar een stukje. Voor elke inleg
 * kijken we naar de koers op die dag en delen we: 12 euro bij een koers van
 * 123,60 is 12 / 123,60 = 0,0971 aandeel. Die stukjes tellen we bij elkaar op.
 * De waarde van zijn portefeuille is daarna simpelweg
 * (totaal aantal stukjes) x (koers van vandaag).
 *
 * Deze module draait zowel tijdens het bouwen (in index.astro) als in de
 * browser (voor de speeltuin), dus: geen imports, geen browser-API's.
 */

/**
 * Index van de laatste beursdag op of vóór `date`.
 * Legt hij geld in op een zaterdag, dan rekenen we met de koers van vrijdag.
 * @returns {number} index in `dates`, of -1 als de datum vóór de reeks ligt
 */
export function indexOnOrBefore(dates, date) {
  let lo = 0;
  let hi = dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Zet ruwe inleg-regels om in "gekochte stukjes", en gooit regels weg die we
 * niet kunnen verwerken (datum in de toekomst, of vóór onze koersdata).
 */
export function resolveDeposits(prices, deposits) {
  const { dates, closes } = prices;
  const resolved = [];

  for (const deposit of deposits) {
    const eur = Number(deposit.eur);
    if (!Number.isFinite(eur) || eur <= 0) continue;

    const index = indexOnOrBefore(dates, deposit.date);
    if (index === -1) continue;

    const price = closes[index];
    resolved.push({
      ...deposit,
      eur,
      index,
      tradingDate: dates[index],
      price,
      shares: eur / price,
    });
  }

  return resolved.sort((a, b) => a.index - b.index);
}

/**
 * De stand van zaken nu: ingelegd, aantal stukjes, huidige waarde, winst.
 */
export function summarise(prices, resolvedDeposits) {
  const price = prices.price ?? prices.closes.at(-1);

  let invested = 0;
  let shares = 0;
  for (const deposit of resolvedDeposits) {
    invested += deposit.eur;
    shares += deposit.shares;
  }

  const value = shares * price;
  const profit = value - invested;

  return {
    price,
    invested,
    shares,
    value,
    profit,
    // Bij nul inleg is het rendement niet gedefinieerd; dan tonen we niets.
    profitPct: invested > 0 ? (profit / invested) * 100 : null,
    // "Een stukje van 9,7% van een heel aandeel" is voor een kind veel
    // concreter dan 0,0971.
    sharePct: shares * 100,
  };
}

/**
 * Waarde van de portefeuille per beursdag, vanaf de eerste inleg.
 * Geeft ook de ingelegde euro's terug, zodat je in de grafiek het verschil
 * tussen "wat erin ging" en "wat het waard is" kunt zien.
 */
export function valueSeries(prices, resolvedDeposits) {
  if (resolvedDeposits.length === 0) return { dates: [], values: [], invested: [] };

  const { dates, closes } = prices;
  const start = resolvedDeposits[0].index;

  const outDates = [];
  const values = [];
  const invested = [];

  let shares = 0;
  let paid = 0;
  let next = 0;

  for (let i = start; i < dates.length; i++) {
    // Alle inlegmomenten tot en met deze dag meetellen.
    while (next < resolvedDeposits.length && resolvedDeposits[next].index <= i) {
      shares += resolvedDeposits[next].shares;
      paid += resolvedDeposits[next].eur;
      next++;
    }
    outDates.push(dates[i]);
    values.push(shares * closes[i]);
    invested.push(paid);
  }

  return { dates: outDates, values, invested };
}

/** Alles in één keer. */
export function computePortfolio(prices, deposits) {
  const resolved = resolveDeposits(prices, deposits);
  return {
    deposits: resolved,
    summary: summarise(prices, resolved),
    series: valueSeries(prices, resolved),
  };
}
