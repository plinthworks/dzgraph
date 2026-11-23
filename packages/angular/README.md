# @dzgraph/angular

DzGraph for Angular 19 to 22: `<dz-chart>` and `<dz-sparkline>`, standalone components with signal inputs and an
output per chart event.

```ts
import { DzChart, DzSparkline } from '@dzgraph/angular';

@Component({
  imports: [DzChart, DzSparkline],
  template: `<dz-chart [options]="options()" (pointClick)="open($event.point)" (viewChange)="save($event.view)" />
             <dz-sparkline [values]="visits()" [options]="{ type: 'area', label: 'Visits' }" />`,
})
```

- Inputs: `options` (required), `types` and `features` (default `allTypes`, `allFeatures`), `messages`, `animate`.
- A new `options` value updates the chart; the user's view (zoom, hidden series, selection) is kept.
- `chart` gives the chart's methods (`exportPng`, `setView`…) once it is drawn; nothing runs on the server (SSR).

See the [repository's README](https://github.com/plinthworks/dzgraph#readme). Licence: MIT.
