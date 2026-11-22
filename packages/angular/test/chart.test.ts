// <dz-chart> (angular.md), compiled and run in a real browser. Step 2.7.
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import type { ChartOptions, PointRef } from '@dzgraph/core';
import type { ChartEvents } from '@dzgraph/dom';
import { DzChart } from '@dzgraph/angular';

@Component({
  imports: [DzChart],
  template: `<dz-chart style="block-size: 300px" [options]="options()" (legendToggle)="toggled.push($event)" (pointClick)="clicked.push($event)" (viewChange)="views.push($event.changed)" />`,
})
class Host {
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
