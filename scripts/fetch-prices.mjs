/**
 * Haalt de dagkoersen van de Vanguard S&P 500 UCITS ETF (VUSA) op en schrijft
 * ze naar src/data/prices.json.
 *
 * Draait in GitHub Actions (zie .github/workflows/update-prices.yml), niet in
 * de browser: geen van beide bronnen stuurt CORS-headers, dus een statische
 * pagina mag ze niet zelf aanroepen. Vandaar dat we de data als bestand in de
 * repo zetten.
 *
 * Er zijn twee bronnen, allebei zonder account of API-sleutel. Ze leveren
 * dezelfde koersen (tot op drie decimalen gecontroleerd). Lukt de eerste niet,
 * dan proberen we de tweede — zo hangt de tracker niet aan één partij.
 *
 * Let op: allebei zijn het openbare endpoints die niet als officiële API
 * bedoeld zijn. Ze kunnen dus zonder aankondiging veranderen. Daarom staat de
 * opgehaalde data als bestand in de repo: gaat het ophalen stuk, dan blijft de
 * site gewoon werken met de laatst bekende koersen.
 *
 * Lokaal draaien:  npm run prices
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/data/prices.json', import.meta.url));

/** Beide bronnen weigeren requests zonder browser-achtige User-Agent. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* -------------------------------------------------------------------------- */
/* Bron 1: Financial Times                                                     */
/* -------------------------------------------------------------------------- */

// Het interne nummer van FT voor VUSA op Euronext Amsterdam, in euro's.
// Te vinden via https://markets.ft.com/data/searchapi/searchsecurities?query=VUSA
const FT_XID = '58518299';

async function fetchFromFT() {
  const res = await fetch('https://markets.ft.com/data/chartapi/series', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      days: 3650, // tien jaar
      dataNormalized: false,
      dataPeriod: 'Day',
      dataInterval: 1,
      realtime: false,
      returnDateType: 'ISO8601',
      elements: [{ Label: 'vusa', Type: 'price', Symbol: FT_XID, Params: {} }],
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  // Bij een onbekend symbool stuurt FT netjes een 200 met alleen een status.
  if (!Array.isArray(json.Dates) || json.Dates.length === 0) {
    throw new Error(json.StatusString || 'geen datums ontvangen');
  }

  const element = json.Elements?.[0];
  const closes = element?.ComponentSeries?.find((s) => s.Type === 'Close')?.Values;
  if (!closes) throw new Error('geen slotkoersen in het antwoord');

  if (element.Currency && element.Currency !== 'EUR') {
    throw new Error(`verwachtte euro's, kreeg ${element.Currency}`);
  }

  return {
    source: 'Financial Times',
    name: element.CompanyName || 'Vanguard S&P 500 UCITS ETF',
    currency: 'EUR',
    exchange: 'Euronext Amsterdam',
    dates: json.Dates.map((d) => d.slice(0, 10)),
    closes,
  };
}

/* -------------------------------------------------------------------------- */
/* Bron 2: Yahoo Finance                                                       */
/* -------------------------------------------------------------------------- */

const YAHOO_SYMBOL = 'VUSA.AS'; // Euronext Amsterdam, noteert in euro's

async function fetchFromYahoo() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_SYMBOL}?range=10y&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('onverwacht antwoord');

  const { meta, timestamp = [], indicators } = result;
  const closes = indicators?.quote?.[0]?.close ?? [];

  return {
    source: 'Yahoo Finance',
    name: meta.longName ?? 'Vanguard S&P 500 UCITS ETF',
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    // Unix-seconden -> 'JJJJ-MM-DD' in UTC, zodat een dag nooit verschuift.
    dates: timestamp.map((s) => new Date(s * 1000).toISOString().slice(0, 10)),
    closes,
  };
}

/* -------------------------------------------------------------------------- */

const SOURCES = [fetchFromFT, fetchFromYahoo];

/** Probeert de bronnen op volgorde; de eerste die bruikbare data geeft, wint. */
async function fetchPrices() {
  const problems = [];

  for (const source of SOURCES) {
    try {
      const raw = await source();

      // Lege dagen komen bij beide bronnen voor (beursdag zonder handel);
      // die laten we weg in plaats van ze als gat door te geven.
      const dates = [];
      const closes = [];
      for (let i = 0; i < raw.dates.length; i++) {
        const close = raw.closes[i];
        if (close == null || !Number.isFinite(close)) continue;
        dates.push(raw.dates[i]);
        closes.push(Math.round(close * 10000) / 10000);
      }

      if (closes.length < 100) throw new Error(`maar ${closes.length} koersen`);
      if (raw.currency !== 'EUR') throw new Error(`verwachtte euro's, kreeg ${raw.currency}`);

      console.log(`${raw.source}: ${closes.length} koersen, laatste ${closes.at(-1)} EUR.`);
      return { ...raw, dates, closes };
    } catch (err) {
      console.warn(`${source.name} mislukt: ${err.message}`);
      problems.push(err.message);
    }
  }

  throw new Error(`geen enkele bron werkte (${problems.join('; ')})`);
}

/* -------------------------------------------------------------------------- */

/** Bestaande koersen inlezen, zodat we ze bij pech kunnen laten staan. */
let previous = null;
try {
  previous = JSON.parse(await readFile(OUT, 'utf8'));
} catch {
  /* bestaat nog niet */
}

let raw;
try {
  raw = await fetchPrices();
} catch (err) {
  // Als het ophalen mislukt maar we hebben al koersen, dan is dat geen ramp:
  // de site blijft werken met de data van gisteren en morgen probeert de
  // workflow het gewoon opnieuw.
  if (previous) {
    console.warn(`Ophalen mislukt (${err.message}). Bestaande koersen blijven staan.`);
    process.exit(0);
  }
  console.error(`Ophalen mislukt en er is nog geen prices.json: ${err.message}`);
  process.exit(1);
}

const data = {
  symbol: YAHOO_SYMBOL,
  name: raw.name,
  currency: raw.currency,
  exchange: raw.exchange,
  source: raw.source,
  price: raw.closes.at(-1),
  updated: new Date().toISOString(),
  dates: raw.dates,
  closes: raw.closes,
};

// Alleen schrijven als er echt iets veranderd is, dan maakt de workflow geen
// lege commits.
const unchanged =
  previous &&
  previous.price === data.price &&
  previous.dates.length === data.dates.length &&
  previous.dates.at(-1) === data.dates.at(-1);

if (unchanged) {
  console.log(`Geen wijziging (${data.price} ${data.currency}).`);
} else {
  await writeFile(OUT, JSON.stringify(data) + '\n');
  console.log(
    `Geschreven: ${data.dates[0]} t/m ${data.dates.at(-1)}, nu ${data.price} ${data.currency}.`
  );
}
