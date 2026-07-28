// @ts-check
import { defineConfig } from 'astro/config';

// Op GitHub Pages staat een "project site" onder https://<naam>.github.io/<repo>/
// De deploy-workflow zet BASE_PATH automatisch op '/<repo>'. Lokaal is dat leeg,
// zodat `npm run dev` gewoon op http://localhost:4321/ draait.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: {
    // CSS meebakken in de HTML: scheelt een extra request.
    inlineStylesheets: 'always',
  },
});
