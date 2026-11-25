/**
 * `provideDzGraph()` (angular.md 9): what an app gives every `<dz-chart>` once, its series types, features and words.
 * A binding on the tag wins. Nothing here imports a type or a feature: the app ships only those it names. Import-safe
 * on a server. Taken from DzGrid's `provideDzGrid`.
 */
import { InjectionToken, type Provider } from '@angular/core';
import type { SeriesType } from '@dzgraph/core/internal';
import type { ChartSetup, Feature } from '@dzgraph/dom';

export interface DzGraphConfig {
  /** The series types every chart may draw (`allTypes` for all of them). */
  readonly types?: readonly SeriesType[];
  /** The features every chart may use (`allFeatures` for all of them). */
  readonly features?: readonly Feature[];
  /** Words over the built-in ones, for every chart that binds none. */
  readonly messages?: ChartSetup['messages'];
}

export const DZGRAPH_CONFIG = new InjectionToken<DzGraphConfig>('dzgraph.config', { providedIn: 'root', factory: () => ({}) });

/** `providers: [provideDzGraph({ types: [line, column], features: [zoom] })]`, in `bootstrapApplication` or a route. */
export function provideDzGraph(config: DzGraphConfig): Provider[] {
  return [{ provide: DZGRAPH_CONFIG, useValue: config }];
}
