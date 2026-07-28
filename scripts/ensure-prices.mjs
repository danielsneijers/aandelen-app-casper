/**
 * Draait automatisch vóór `npm run dev` en `npm run build`.
 *
 * Normaal staat src/data/prices.json gewoon in de repo en doet dit niets.
 * Is het bestand er nog niet — vers begonnen, of net gekloond zonder data —
 * dan halen we de koersen eerst op, zodat je niet tegen een onbegrijpelijke
 * "module not found" aanloopt.
 */
import { access } from 'node:fs/promises';

const target = new URL('../src/data/prices.json', import.meta.url);

try {
  await access(target);
} catch {
  console.log('Nog geen koersen gevonden — die haal ik eerst op...\n');
  // Het importeren voert fetch-prices.mjs uit; die stopt zelf met een
  // duidelijke melding als het ophalen niet lukt.
  await import('./fetch-prices.mjs');
}
