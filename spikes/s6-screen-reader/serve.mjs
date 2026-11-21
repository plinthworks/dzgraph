// S6: serves the listening page and keeps running. node spikes/s6-screen-reader/serve.mjs
import { serve } from '../kit.mjs';
const site = await serve(import.meta.url);
console.log(`Ouvrir : ${site.url()}  (Ctrl+C pour arrêter)`);
