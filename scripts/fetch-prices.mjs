/**
 * Haalt de dagkoersen van de Vanguard S&P 500 UCITS ETF (VUSA) op en schrijft
 * ze naar src/data/prices.json.
 *
 * Draait in GitHub Actions (zie .github/workflows/update-prices.yml), niet in
 * de browser: Yahoo stuurt geen CORS-headers, dus een statische pagina mag deze
 * URL niet zelf aanroepen. Vandaar dat we de data als bestand in de repo zetten.
 *
 * Lokaal draaien:  npm run prices
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SYMBOL = 'VUSA.AS'; // Euronext Amsterdam, noteert in euro's
const RANGE = '10y';
const OUT = fileURLToPath(new URL('../src/data/prices.json', import.meta.url));

const URL_ = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=${RANGE}&interval=1d`;

/** Yahoo weigert requests zonder browser-achtige User-Agent. */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};

/**
 * Yahoo deelt regelmatig een 429 uit aan gedeelde IP-adressen (zoals die van
 * GitHub Actions). Daarom rustig opnieuw proberen met oplopende wachttijd.
 */
async function fetchChart(attempt = 1) {
  const MAX_ATTEMPTS = 5;
  try {
    const res = await fetch(URL_, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    const wait = 15000 * attempt;
    console.warn(`Poging ${attempt} mislukt (${err.message}), opnieuw over ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchChart(attempt + 1);
  }
}

/** Bestaande koersen inlezen, zodat we ze bij pech kunnen laten staan. */
async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

/** Unix-seconden -> 'YYYY-MM-DD' in UTC, zodat een dag nooit verschuift. */
function isoDate(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

const previous = await readPrevious();

let json;
try {
  json = await fetchChart();
} catch (err) {
  // Belangrijk: als het ophalen mislukt maar we hebben al koersen, dan is dat
  // geen ramp. De site blijft werken met de data van gisteren en morgen
  // probeert de workflow het gewoon opnieuw.
  if (previous) {
    console.warn(`Ophalen mislukt (${err.message}). Bestaande koersen blijven staan.`);
    process.exit(0);
  }
  console.error(`Ophalen mislukt en er is nog geen prices.json: ${err.message}`);
  process.exit(1);
}

const result = json?.chart?.result?.[0];
if (!result) {
  throw new Error(`Onverwacht antwoord van Yahoo: ${JSON.stringify(json).slice(0, 300)}`);
}

const { meta, timestamp = [], indicators } = result;
const closes = indicators?.quote?.[0]?.close ?? [];

const dates = [];
const values = [];
for (let i = 0; i < timestamp.length; i++) {
  const close = closes[i];
  // Yahoo levert soms een null voor een beursdag zonder handel; die slaan we over.
  if (close == null || !Number.isFinite(close)) continue;
  dates.push(isoDate(timestamp[i]));
  values.push(Math.round(close * 10000) / 10000);
}

if (values.length < 100) {
  throw new Error(`Te weinig koersen ontvangen (${values.length}); bestand niet overschreven.`);
}

// De laatste "koers" is de live/laatste prijs; die kan intraday afwijken van de
// slotkoers van vandaag. Voor dit doel is dat precies wat we willen laten zien.
const data = {
  symbol: meta.symbol,
  name: meta.longName ?? 'Vanguard S&P 500 UCITS ETF',
  currency: meta.currency,
  exchange: meta.fullExchangeName ?? meta.exchangeName,
  price: Math.round((meta.regularMarketPrice ?? values.at(-1)) * 10000) / 10000,
  updated: new Date().toISOString(),
  dates,
  closes: values,
};

// Alleen schrijven als er echt iets veranderd is, dan maakt de workflow geen
// lege commits.
const sameData =
  previous &&
  previous.price === data.price &&
  previous.dates.length === data.dates.length &&
  previous.dates.at(-1) === data.dates.at(-1);

if (sameData) {
  console.log(`Geen wijziging (${data.symbol} @ ${data.price} ${data.currency}).`);
} else {
  await writeFile(OUT, JSON.stringify(data) + '\n');
  console.log(
    `Geschreven: ${data.dates.length} koersen, ${data.dates[0]} t/m ${data.dates.at(-1)}, ` +
      `nu ${data.price} ${data.currency}.`
  );
}
