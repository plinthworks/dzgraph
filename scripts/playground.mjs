// The playground (made-up data): npm run playground, then http://127.0.0.1:4750/playground/ (DzGrid 4700, DzTooltip 4740,
// the owner's app 4730/4731). TypeScript served compiled on the fly (spikes/kit.mjs). Ctrl+C stops it.
import { serve } from '../spikes/kit.mjs';

const site = await serve(new URL('../playground/index.html', import.meta.url).href, { port: 4750 });
console.log(`Playground: ${site.root('playground/')}`);
