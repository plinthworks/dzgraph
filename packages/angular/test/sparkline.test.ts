// <dz-sparkline> (angular.md 8, sparkline.md), compiled and run in a real browser. Phase 7a.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DzSparkline } from '@dzgraph/angular';

@Component({
  imports: [DzSparkline],
  template: `<p lang="en"><dz-sparkline [values]="values()" [options]="{ label: 'Visits' }" /></p>`,
})
class Host {
  readonly values = signal<readonly (number | null)[]>([1, 5, 4]);
}

describe('<dz-sparkline> (angular.md 8)', () => {
  it('draws its values, named by its label and summary; a new value draws it again', async () => {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const name = () => fixture.nativeElement.querySelector('svg.dzgraph-sparkline')?.getAttribute('aria-label');
    expect(name()).toBe('Visits: 3 values, from 1 to 5, last 4');
    fixture.componentInstance.values.set([2, 9]);
    await fixture.whenStable();
    expect(name()).toBe('Visits: 2 values, from 2 to 9, last 9');
    expect(fixture.nativeElement.querySelectorAll('svg').length).toBe(1);
    fixture.destroy();
    expect(document.querySelector('svg.dzgraph-sparkline')).toBeNull();
  });
});
