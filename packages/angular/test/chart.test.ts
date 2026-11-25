// <dz-chart> (angular.md), compiled and run in a real browser. Step 2.7.
import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { allTypes, type ChartOptions, type PointRef, type Problem } from '@dzgraph/core';
import { allFeatures, type ChartEvents } from '@dzgraph/dom';
import { DzChart, provideDzGraph } from '@dzgraph/angular';

@Component({
  imports: [DzChart],
  template: `<dz-chart style="block-size: 300px" [options]="options()" [types]="types" [features]="features" (legendToggle)="toggled.push($event)" (pointClick)="clicked.push($event)" (viewChange)="views.push($event.changed)" />`,
})
class Host {
  readonly types = allTypes;
  readonly features = allFeatures;
  readonly options = signal<ChartOptions>({
    animation: false,
    series: [
      { type: 'line', id: 'a', name: 'Apples', data: [1, 2, 3] },
      { type: 'line', id: 'b', name: 'Pears', data: [3, 2, 1] },
    ],
  });
  readonly toggled: { seriesId: string; shown: boolean }[] = [];
  readonly clicked: PointRef[] = [];
  readonly views: (readonly string[])[] = [];
  readonly chart = viewChild.required(DzChart);
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function mount() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.nativeElement.style.inlineSize = '500px';
  await fixture.whenStable();
  return fixture;
}

describe('<dz-chart> (angular.md)', () => {
  it('draws in its host, at the host\'s size (1)', async () => {
    const f = await mount();
    const svg = f.nativeElement.querySelector('dz-chart svg')!;
    expect(svg.getAttribute('height')).toBe('300');
    expect(f.nativeElement.querySelectorAll('[data-layer="series"] path[fill="none"]').length).toBe(2);
    f.destroy();
  });

  it('a new value of the options updates the chart, without re-creating it (2)', async () => {
    const f = await mount();
    const svg = f.nativeElement.querySelector('dz-chart svg');
    f.componentInstance.options.update((o) => ({ ...o, series: o.series.slice(0, 1) }));
    await f.whenStable();
    await frame();
    expect(f.nativeElement.querySelector('dz-chart svg')).toBe(svg);
    expect(f.nativeElement.querySelectorAll('[data-layer="series"] path[fill="none"]').length).toBe(1);
    f.destroy();
  });

  it('a field the new options no longer have goes back to its default (review 7)', async () => {
    const f = await mount();
    f.componentInstance.options.update((o) => ({ ...o, title: 'Fruit' }));
    await f.whenStable();
    await frame();
    expect(f.nativeElement.querySelector('[role="figure"]')!.getAttribute('aria-label')).toBe('Fruit');
    f.componentInstance.options.update(({ title: _gone, ...rest }) => rest);
    await f.whenStable();
    await frame();
    expect(f.nativeElement.querySelector('[role="figure"]')!.getAttribute('aria-label')).toBe('Chart');
    f.destroy();
  });

  it('an output per event (3)', async () => {
    const f = await mount();
    f.nativeElement.querySelector('.dzgraph-legend-button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(f.componentInstance.toggled).toEqual([{ seriesId: 'a', shown: false }]);
    // The Phase 5 events too (view-state.md 4): hiding a series changes the view.
    expect(f.componentInstance.views).toEqual([['hidden']]);
    f.destroy();
  });

  it('the chart\'s methods through `chart`: an export (7, Phase 6)', async () => {
    const f = await mount();
    await frame();
    expect(f.componentInstance.chart().chart?.exportCsv()).toBe('\uFEFFX value,Apples,Pears\r\n0,1,3\r\n1,2,2\r\n2,3,1\r\n');
    f.destroy();
  });

  it('an output for every event of the chart, none forgotten (3)', async () => {
    // Every event by name: TypeScript refuses this list when the chart gains an event it does not name.
    const events = { problems: true, pointHover: true, pointClick: true, pointFocus: true, legendToggle: true, rangeChange: true, viewChange: true, modeChange: true, selectionChange: true, measure: true, drill: true } satisfies Record<keyof ChartEvents, true>;
    const f = await mount();
    const component = f.componentInstance.chart() as unknown as Record<string, { subscribe?: unknown }>; // read by name below
    expect(Object.keys(events).filter((e) => typeof component[e]?.subscribe !== 'function')).toEqual([]);
    f.destroy();
  });

  it('destroying the component destroys the chart (4)', async () => {
    const f = await mount();
    const host = f.nativeElement.querySelector('dz-chart')!;
    f.destroy();
    expect(host.children.length).toBe(0);
  });
});

describe('<dz-chart> before it is drawn and on the server (angular.md 5, 7)', () => {
  it('7: `chart` is null until the first render, then the chart', async () => {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    fixture.nativeElement.style.inlineSize = '500px';
    // Created, not yet rendered: no chart.
    expect(fixture.componentInstance.chart().chart).toBeNull();
    await fixture.whenStable();
    expect(fixture.componentInstance.chart().chart?.getView()).toEqual(expect.any(Object));
    fixture.destroy();
  });

  it('5: on the server nothing is drawn and nothing fails; `chart` stays null', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    await frame();
    expect(fixture.componentInstance.chart().chart).toBeNull();
    expect(fixture.nativeElement.querySelector('dz-chart svg')).toBeNull();
    fixture.destroy();
  });
});

// The app's types, features and words, on the tag or once for the app (angular.md 9).
@Component({
  imports: [DzChart],
  template: `<dz-chart style="block-size: 200px" [options]="options" (problems)="problems.push($event)" />`,
})
class Bare {
  readonly options: ChartOptions = { animation: false, series: [{ type: 'line', id: 'a', data: [1, 2, 3] }] };
  readonly problems: (readonly Problem[])[] = [];
  readonly chart = viewChild.required(DzChart);
}

async function mountBare() {
  const fixture = TestBed.createComponent(Bare);
  document.body.appendChild(fixture.nativeElement);
  fixture.nativeElement.style.inlineSize = '400px';
  await fixture.whenStable();
  await frame();
  return fixture;
}

describe('what <dz-chart> ships (angular.md 9)', () => {
  it('no types bound, none provided: it imports none, and the chart says so', async () => {
    TestBed.resetTestingModule();
    const fixture = await mountBare();
    expect(fixture.componentInstance.chart().chart!.problems.map((p) => [p.code, p.path])).toEqual([['unknown-series-type', 'series[0].type']]);
    fixture.destroy();
  });

  it('provided once for the app: drawn without a binding', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDzGraph({ types: allTypes, features: allFeatures, messages: { chart: 'Graphique maison' } })] });
    const fixture = await mountBare();
    const c = fixture.componentInstance.chart().chart!;
    expect(c.problems).toEqual([]);
    expect(fixture.nativeElement.querySelector('.dzgraph')?.getAttribute('aria-label')).toBe('Graphique maison');
    fixture.destroy();
  });
});
