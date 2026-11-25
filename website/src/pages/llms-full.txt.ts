/**
 * `/dzgraph/llms-full.txt`: every English page of the site in one Markdown file, made by scripts/llms.mjs and kept at
 * the repository's root (website/test/llms.test.ts holds it to the pages). Served as written.
 */
import text from '../../../llms-full.txt?raw';

export const GET = () => new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
