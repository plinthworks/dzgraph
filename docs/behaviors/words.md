# The chart's words

Phase 9 (owner 2026-11-25, « fais au mieux »). The words a chart writes itself: its menu, the breadcrumb, the data
table's headings, what screen readers hear. English and French built in, chosen by the chart's language.

## What the app does
Gives its own words in `chart(el, options, { messages })` (`[messages]` on `<dz-chart>`): another language, or one
word changed.

## What they observe
1. A word given replaces the built-in one; every word not given stays built in.
2. A group of words (`menu`, `drill`, `exporting`, `meter`…) is merged word by word: `{ drill: { retry: 'Encore' } }`
   changes only « Réessayer »; the group's other words stay. A word that is a function (a sentence built from
   values) is replaced whole.
3. A key the chart has no word for is ignored, at any depth.
4. The words follow the chart's language: the built-in words are the language's (English for one not built in), the
   app's on top.
