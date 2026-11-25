// Two <dz-chart> linked by their parent (the site's Angular guide, linked-charts.md): a `read` callback of
// afterNextRender, registered in the parent's constructor, finds both charts drawn — each draws in its own callback of
// the same render, in the phase before `read`.
import { afterNextRender, Component, DestroyRef, inject, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { allTypes, type ChartOptions } from '@dzgraph/core';
import { allFeatures, linkCharts, type Chart } from '@dzgraph/dom';
import { DzChart } from '@dzgraph/angular';

@Component({
  imports: [DzChart],
  template: `
    <dz-chart style="block-size: 200px" [options]="heat" [types]="types" [features]="features" />
    <dz-chart style="block-size: 200px" [options]="bees" [types]="types" [features]="features" />
  `,
})
class Garden {
  readonly charts = viewChildren(DzChart);
  readonly types = allTypes;
  readonly features = allFeatures;
  readonly heat: ChartOptions = { animation: false, crosshair: true, series: [{ type: 'line', id: 'heat', data: [14, 17, 21, 24, 23, 19, 15] }] };
  readonly bees: ChartOptions = { animation: false, crosshair: true, series: [{ type: 'column', id: 'bees', data: [12, 30, 52, 61, 58, 44, 23] }] };
  linked: Chart[] = [];

  constructor() {
    let unlink = () => {};
    afterNextRender({
      read: () => {
        this.linked = this.charts().flatMap((dz) => (dz.chart ? [dz.chart] : []));
        unlink = linkCharts(this.linked, { crosshair: true, zoom: 'x' });
      },
    });
    inject(DestroyRef).onDestroy(() => unlink());
  }
}

describe('two <dz-chart> linked by their parent', () => {
  it('the parent\'s read callback finds both drawn; a zoom on one is the other\'s', async () => {
    const fixture = TestBed.createComponent(Garden);
    document.body.appendChild(fixture.nativeElement);
    fixture.nativeElement.style.inlineSize = '500px';
    await fixture.whenStable();
    const [heat, bees] = fixture.componentInstance.linked;
    expect(fixture.componentInstance.linked).toHaveLength(2);
    heat!.setRange({ min: 1, max: 4 });
    expect(bees!.getView().range).toEqual({ min: 1, max: 4 });
    fixture.destroy();
  });
});
