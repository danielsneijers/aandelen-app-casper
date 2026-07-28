# Casper's S&P 500 tracker

Een pagina die de koers van de **Vanguard S&P 500 UCITS ETF USD Dis** (`VUSA`, Euronext
Amsterdam) volgt en laat zien wat Caspers stukje van een aandeel waard is.

Geen echt geld, geen broker — alleen rekenen en kijken.

## Hoe het werkt

Eén heel aandeel kost ruim €120. Casper legt €12 of €25 in, dus koopt hij een *stukje*:

```
€12 ÷ €123,68 per aandeel = 0,0970 aandeel
```

Dat stukje blijft even groot. Alleen de koers beweegt, en daarmee de waarde.
Bij meerdere inlegmomenten telt de app de stukjes bij elkaar op — elk gekocht tegen
de koers van díé dag.

## Nieuwe inleg toevoegen

Zet er een regel bij in [`src/data/deposits.json`](src/data/deposits.json) en push:

```json
[
  { "date": "2026-07-28", "eur": 12, "note": "Eerste inleg" },
  { "date": "2026-08-15", "eur": 25, "note": "Verjaardagsgeld" }
]
```

- `date` — de dag dat hij je het geld gaf, als `JJJJ-MM-DD`. Valt dat in het weekend,
  dan rekent de app met de laatste beursdag ervóór.
- `eur` — het bedrag.
- `note` — optioneel, puur voor jezelf.

Elke push naar `main` zet de site automatisch opnieuw online.

Wil hij zelf iets uitproberen zonder de echte cijfers aan te raken, dan kan dat in de
**Speeltuin** op de pagina. Die proef-inleg blijft in zijn eigen browser staan
(`localStorage`) en komt niet in dit bestand terecht.

## Lokaal draaien

```bash
npm install
npm run dev
```

Koersen handmatig ophalen:

```bash
npm run prices
```

Het rekenwerk controleren (weekenddatums, meerdere inlegmomenten, lege portefeuille):

```bash
npm test
```

Deze test draait ook bij elke deploy. Klopt er iets niet, dan gaat de site niet online.

## Waar de koersen vandaan komen

Geen van de bronnen stuurt CORS-headers, dus de pagina mag ze niet zelf uit de browser
ophalen. In plaats daarvan draait er een GitHub Action
([`update-prices.yml`](.github/workflows/update-prices.yml)) van dinsdag t/m zaterdag om
04:00 UTC — 06:00 in de zomer, 05:00 in de winter. Die haalt de koersen op, schrijft ze
naar `src/data/prices.json`, commit dat bestand en zet de site opnieuw online.

Zo staat er 's ochtends altijd een verse slotkoers klaar, en verandert het getal verder
niet meer die dag. De zaterdagrun zorgt dat het weekend de vrijdagkoers laat zien in
plaats van die van donderdag.

> GitHub draait cron altijd in UTC en houdt géén rekening met zomer- en wintertijd, dus
> de lokale tijd verschuift twee keer per jaar een uur. En de planner is "zo snel als het
> uitkomt": een kwartier later is normaal, dus reken er niet op tot op de minuut.

Er zijn **twee bronnen, allebei zonder account of API-sleutel**:

1. **Financial Times** (`markets.ft.com`) — levert tien jaar dagkoersen in euro's van de
   Amsterdamse notering. Dit is de eerste keuze.
2. **Yahoo Finance** (`VUSA.AS`) — reserve, wordt alleen gebruikt als de eerste faalt.

Ze leveren dezelfde cijfers; dat is tot op drie decimalen nagerekend. Faalt de eerste,
dan schuift het script vanzelf door naar de tweede. Falen ze allebei, dan blijft de
bestaande `prices.json` staan en probeert de workflow het de volgende dag opnieuw. De
site blijft dus altijd werken.

> Allebei zijn het openbare endpoints die niet als officiële API bedoeld zijn — ze kunnen
> zonder aankondiging veranderen. Daarom staat de opgehaalde data als gewoon bestand in je
> eigen repo: ook als beide bronnen ooit stoppen, blijft de historie die je al hebt gewoon
> staan. Yahoo deelt bovendien soms een `429` uit aan IP-adressen die te snel achter elkaar
> vragen, wat precies de reden is dat er een tweede bron is.

Voordelen: geen server, geen API-sleutel, geen account, en de koershistorie staat als
gewoon bestand in je eigen repo.

## Eenmalig instellen op GitHub

0. Haal eerst één keer de koersen op en commit het resultaat, zodat de repo meteen
   data heeft:

   ```bash
   npm run prices
   ```

1. Push deze map naar een GitHub-repo met `main` als hoofdbranch.
2. **Settings → Pages → Build and deployment → Source**: zet op **GitHub Actions**.
3. **Settings → Actions → General → Workflow permissions**: zet op
   **Read and write permissions**. Zonder dit mag de koers-workflow niet committen.
4. Ga naar **Actions → Koersen bijwerken → Run workflow** om het meteen te testen.

De site komt op `https://<jouw-gebruikersnaam>.github.io/<repo-naam>/` te staan. Het
juiste pad wordt automatisch bepaald, daar hoef je niets voor aan te passen.

> Geplande workflows worden door GitHub gepauzeerd als er 60 dagen niets in de repo
> gebeurt. Je krijgt daar een mail over; één klik op *Run workflow* zet hem weer aan.

## Een ander fonds volgen

Pas in [`scripts/fetch-prices.mjs`](scripts/fetch-prices.mjs) allebei de bronnen aan:
`FT_XID` en `YAHOO_SYMBOL`. Draai daarna `npm run prices`.

Het FT-nummer van een fonds vind je zo:

```bash
curl -s "https://markets.ft.com/data/searchapi/searchsecurities?query=VUSA"
```

Let op de beurs die je kiest — `VUSA:AEX:EUR` (Amsterdam) noteert in euro's, de Londense
in ponden. Het script weigert data die niet in euro's staat, want de app rekent overal
met euro's.

## Wat waar staat

| Bestand | Wat het doet |
| --- | --- |
| `src/pages/index.astro` | De hele pagina: opmaak, grafiek, speeltuin |
| `src/lib/portfolio.js` | Het rekenwerk (stukjes, waarde, winst) |
| `src/lib/format.js` | Nederlandse opmaak van bedragen en datums |
| `src/data/deposits.json` | Zijn echte inleg — dit bewerk je zelf |
| `src/data/prices.json` | Opgehaalde koersen — hier blijf je vanaf |
| `scripts/fetch-prices.mjs` | Haalt de koersen op |
| `scripts/portfolio.test.mjs` | Controleert het rekenwerk |
