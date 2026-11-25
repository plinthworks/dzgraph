/**
 * `/dzgraph/llms.txt`: the site's index for a language model, made by scripts/llms.mjs from the English pages and kept
 * at the repository's root (website/test/llms.test.ts holds it to them). Served as written.
 */
import text from '../../../llms.txt?raw';

export const GET = () => new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
