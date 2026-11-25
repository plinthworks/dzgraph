/**
 * The gauge workshop (owner 2026-11-25): every part of a gauge set by hand — its value, scale, origin, ticks,
 * thickness, shape and zones, each with buttons to go up and down, the names typed in — the chart following live and
 * the options written under it, ready to copy. One module for the site's gauge page (GaugeWorkshop.astro) and the
 * playground (playground/workshop.html). The chart comes from the caller (`make`), so this file needs no build of the
 * library. Elements made with the DOM, texts set as text: no HTML is parsed.
 */
import type { ChartOptions } from '@dzgraph/core';

/** What the workshop needs of a chart. */
export interface WorkshopChart {
  update(changes: Partial<ChartOptions>): void;
}

interface Zone {
  from: number;
  to: number;
  label: string;
}

interface State {
  title: string;
  name: string;
  value: number;
  min: number;
  max: number;
  origin: number;
  step: number;
  labels: number;
  thickness: number;
  shape: 'arc' | 'bar';
  orientation: 'horizontal' | 'vertical';
  on: 'ring' | 'track';
  zones: Zone[];
}

const WORDS = {
  en: {
    title: 'Title',
    name: 'Name',
    value: 'Value',
    min: 'Minimum',
    max: 'Maximum',
    origin: 'Origin',
    step: 'Tick every',
    labels: 'Number every',
    thickness: 'Thickness (px)',
    shape: 'Shape',
    arc: 'Arc',
    bar: 'Bar',
    orientation: 'Direction',
    across: 'Across',
    upright: 'Upright',
    on: 'Zones drawn',
    ring: 'Ring',
    track: 'On the track',
    zones: 'Zones',
    zone: (n: number) => `Zone ${n}`,
    from: 'From',
    to: 'To',
    label: 'Label',
    add: 'Add a zone',
    remove: (n: number) => `Remove zone ${n}`,
    less: (what: string) => `Less: ${what}`,
    more: (what: string) => `More: ${what}`,
    code: 'The options',
    start: { title: 'Tank balance (made up)', name: 'Balance', zones: ['Cold', 'Normal', 'Hot'] },
  },
  fr: {
    title: 'Titre',
    name: 'Nom',
    value: 'Valeur',
    min: 'Minimum',
    max: 'Maximum',
    origin: 'Origine',
    step: 'Un trait tous les',
    labels: 'Un nombre tous les',
    thickness: 'Épaisseur (px)',
    shape: 'Forme',
    arc: 'Arc',
    bar: 'Barre',
    orientation: 'Sens',
    across: 'Couchée',
    upright: 'Debout',
    on: 'Zones dessinées',
    ring: 'Anneau',
    track: 'Sur la piste',
    zones: 'Zones',
    zone: (n: number) => `Zone ${n}`,
    from: 'De',
    to: 'À',
    label: 'Nom',
    add: 'Ajouter une zone',
    remove: (n: number) => `Retirer la zone ${n}`,
    less: (what: string) => `Moins : ${what}`,
    more: (what: string) => `Plus : ${what}`,
    code: 'Les options',
    start: { title: 'Bilan du réservoir (fictif)', name: 'Bilan', zones: ['Froid', 'Normal', 'Chaud'] },
  },
};

/** The tick steps the buttons go through. */
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
/** The colour names the zones take in turn; the page defines them (`--dzgraph-color-zone-1`…). */
const COLORS = 4;

/** The gauge's options from the workshop's state. */
export function workshopOptions(s: State): Partial<ChartOptions> {
  return {
    title: { text: s.title },
    series: [
      {
        type: 'gauge',
        id: 'gauge',
        name: s.name,
        data: s.value,
        min: s.min,
        max: s.max,
        origin: s.origin,
        ticks: { step: s.step, labels: s.labels },
        thickness: s.thickness,
        shape: s.shape,
        ...(s.shape === 'bar' ? { orientation: s.orientation } : {}),
        thresholdsOn: s.on,
        thresholds: s.zones.map((z, k) => ({ from: z.from, to: z.to, label: z.label, color: `zone-${(k % COLORS) + 1}` })),
      },
    ],
  };
}

/**
 * Builds the workshop in `host`: the controls, a box for the chart (given to `make` once, then updated), the options
 * as code.
 */
export function gaugeWorkshop(host: HTMLElement, lang: 'en' | 'fr', make: (box: HTMLElement, options: Partial<ChartOptions>) => WorkshopChart): void {
  const w = WORDS[lang];
  const s: State = {
    title: w.start.title,
    name: w.start.name,
    value: -1700,
    min: -2000,
    max: 2000,
    origin: 0,
    step: 100,
    labels: 500,
    thickness: 32,
    shape: 'arc',
    orientation: 'horizontal',
    on: 'track',
    zones: [
      { from: -2000, to: -1500, label: w.start.zones[0]! },
      { from: -500, to: 500, label: w.start.zones[1]! },
    ],
  };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const controls = el('div', 'gw-controls');
  const box = el('div', 'gw-chart');
  const codeBox = el('details', 'gw-code');
  codeBox.append(el('summary', undefined, w.code));
  const code = el('code');
  const pre = el('pre');
  pre.append(code);
  codeBox.append(pre);
  host.replaceChildren(controls, box, codeBox);

  let ids = 0;
  let chart: WorkshopChart | null = null;
  const draw = () => {
    const options = workshopOptions(s);
    code.textContent = JSON.stringify(options.series?.[0], null, 2);
    if (chart) chart.update(options);
    else chart = make(box, options);
  };

  /** A labelled number, with a button down and a button up. */
  const stepper = (parent: HTMLElement, label: string, get: () => number, set: (v: number) => void, down: (v: number) => number, up: (v: number) => number) => {
    const row = el('div', 'gw-row');
    const id = `gw-${host.id || 'w'}-${++ids}`;
    const name = el('label', undefined, label);
    name.htmlFor = id;
    const input = el('input');
    input.type = 'number';
    input.id = id;
    input.value = String(get());
    const minus = el('button', 'gw-step', '−');
    const plus = el('button', 'gw-step', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', w.less(label));
    plus.setAttribute('aria-label', w.more(label));
    const put = (v: number) => {
      if (!Number.isFinite(v)) return;
      set(v);
      input.value = String(get());
      draw();
    };
    minus.addEventListener('click', () => put(down(get())));
    plus.addEventListener('click', () => put(up(get())));
    input.addEventListener('change', () => put(Number(input.value)));
    row.append(name, minus, input, plus);
    parent.append(row);
    return input;
  };
  /** Two or three words, one chosen. */
  const choice = <T extends string>(label: string, options: readonly [T, string][], get: () => T, set: (v: T) => void, after?: () => void) => {
    const row = el('div', 'gw-row');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.append(el('span', 'gw-label', label));
    const buttons = options.map(([v, text]) => {
      const b = el('button', 'gw-choice', text);
      b.type = 'button';
      b.addEventListener('click', () => {
        set(v);
        for (const [k, o] of buttons) o.setAttribute('aria-pressed', String(k === get()));
        after?.();
        draw();
      });
      b.setAttribute('aria-pressed', String(v === get()));
      row.append(b);
      return [v, b] as const;
    });
    controls.append(row);
    return row;
  };
  const text = (parent: HTMLElement, label: string, get: () => string, set: (v: string) => void) => {
    const row = el('div', 'gw-row');
    const id = `gw-${host.id || 'w'}-${++ids}`;
    const name = el('label', undefined, label);
    name.htmlFor = id;
    const input = el('input');
    input.id = id;
    input.value = get();
    input.addEventListener('input', () => {
      set(input.value);
      draw();
    });
    row.append(name, input);
    parent.append(row);
  };

  text(controls, w.title, () => s.title, (v) => (s.title = v));
  text(controls, w.name, () => s.name, (v) => (s.name = v));
  const by = () => s.step;
  stepper(controls, w.value, () => s.value, (v) => (s.value = v), (v) => v - by(), (v) => v + by());
  stepper(controls, w.min, () => s.min, (v) => (s.min = v), (v) => v - by() * 5, (v) => v + by() * 5);
  stepper(controls, w.max, () => s.max, (v) => (s.max = v), (v) => v - by() * 5, (v) => v + by() * 5);
  stepper(controls, w.origin, () => s.origin, (v) => (s.origin = v), (v) => v - by(), (v) => v + by());
  const nice = (v: number, dir: 1 | -1) => (dir > 0 ? (STEPS.find((x) => x > v) ?? v) : ([...STEPS].reverse().find((x) => x < v) ?? v));
  const labelsInput = { el: null as HTMLInputElement | null };
  stepper(controls, w.step, () => s.step, (v) => {
    s.step = v;
    // The numbers stay a multiple of the ticks (gauge.md 14).
    s.labels = Math.max(v, Math.round(s.labels / v) * v);
    if (labelsInput.el) labelsInput.el.value = String(s.labels);
  }, (v) => nice(v, -1), (v) => nice(v, 1));
  labelsInput.el = stepper(controls, w.labels, () => s.labels, (v) => (s.labels = v), (v) => Math.max(s.step, v - s.step), (v) => v + s.step);
  stepper(controls, w.thickness, () => s.thickness, (v) => (s.thickness = v), (v) => Math.max(4, v - 4), (v) => v + 4);
  let across: HTMLElement | null = null;
  const showAcross = () => across?.toggleAttribute('hidden', s.shape !== 'bar');
  choice(w.shape, [['arc', w.arc], ['bar', w.bar]], () => s.shape, (v) => (s.shape = v), showAcross);
  across = choice(w.orientation, [['horizontal', w.across], ['vertical', w.upright]], () => s.orientation, (v) => (s.orientation = v));
  showAcross();
  choice(w.on, [['ring', w.ring], ['track', w.track]], () => s.on, (v) => (s.on = v));

  // The zones: each its name and its two ends; one more, or one fewer.
  const zones = el('fieldset', 'gw-zones');
  controls.append(zones);
  const listZones = () => {
    zones.replaceChildren(el('legend', undefined, w.zones));
    s.zones.forEach((z, k) => {
      const item = el('div', 'gw-zone');
      item.append(el('span', 'gw-label', w.zone(k + 1)));
      text(item, w.label, () => z.label, (v) => (z.label = v));
      stepper(item, w.from, () => z.from, (v) => (z.from = v), (v) => v - by(), (v) => v + by());
      stepper(item, w.to, () => z.to, (v) => (z.to = v), (v) => v - by(), (v) => v + by());
      const remove = el('button', 'gw-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', w.remove(k + 1));
      remove.addEventListener('click', () => {
        s.zones.splice(k, 1);
        listZones();
        draw();
      });
      item.append(remove);
      zones.append(item);
    });
    const add = el('button', 'gw-add', w.add);
    add.type = 'button';
    add.addEventListener('click', () => {
      const from = Math.min(s.max - s.step, s.zones.at(-1)?.to ?? s.min);
      s.zones.push({ from, to: Math.min(s.max, from + s.step * 5), label: w.start.zones[s.zones.length % w.start.zones.length]! });
      listZones();
      draw();
    });
    zones.append(add);
  };
  listZones();
  draw();
}
