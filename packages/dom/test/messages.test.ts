// The chart's words (words.md): the app's on top of the built-in ones, merged word by word. Expectations by hand.
import { describe, expect, it } from 'vitest';
import { messagesFor } from '../src/messages.js';

describe('the app\'s words (words.md)', () => {
  it('one word of a group changed; the group\'s other words kept', () => {
    const m = messagesFor('fr', { drill: { retry: 'Encore' } });
    expect(m.drill.retry).toBe('Encore');
    expect(m.drill.loading).toBe(messagesFor('fr').drill.loading);
    expect(m.drill.loading.length).toBeGreaterThan(0);
  });

  it('two levels down: one period of the menu', () => {
    const m = messagesFor('en', { menu: { periods: { week: 'Wk' } } });
    expect(m.menu.periods.week).toBe('Wk');
    expect(m.menu.periods.month).toBe(messagesFor('en').menu.periods.month);
  });

  it('a word alone, and a sentence given as a function, replace the built-in ones', () => {
    const own = () => 'Mine';
    const m = messagesFor('en', { chart: 'Graph', summary: own });
    expect([m.chart, m.summary]).toEqual(['Graph', own]);
  });

  it('a key with no word is ignored, at any depth; the prototype is never reached', () => {
    const odd = JSON.parse('{ "nothing": "x", "drill": { "nope": "y", "__proto__": { "polluted": true } }, "__proto__": { "polluted": true } }');
    const m = messagesFor('en', odd) as unknown as Record<string, unknown>;
    expect(m['nothing']).toBeUndefined();
    expect((m['drill'] as Record<string, unknown>)['nope']).toBeUndefined();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(m)).toBe(Object.prototype);
  });

  it('a word of the wrong kind is ignored, the built-in one kept (words.md 3, review 2026-11-26)', () => {
    const en = messagesFor('en');
    // A text where a group belongs, a group where a sentence belongs, a text where a sentence belongs, a number for a text.
    const odd = JSON.parse('{ "drill": "Retry", "summary": { "x": 1 }, "since": "then", "chart": 3 }');
    const m = messagesFor('en', odd);
    expect(m.drill).toEqual(en.drill);
    expect([m.summary, m.since, m.chart]).toEqual([en.summary, en.since, en.chart]);
  });

  it('the built-in words are never changed by an app\'s', () => {
    messagesFor('en', { drill: { retry: 'Changed' } });
    expect(messagesFor('en').drill.retry).not.toBe('Changed');
  });
});
