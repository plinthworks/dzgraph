# @dzgraph/dztooltip

DzGraph's points' tooltip drawn by [DzTooltip](https://github.com/plinthworks/dztooltip) (`@dztooltip/core` ^1.0.0):
its placements, tones, shapes and animations. The chart still decides what the tooltip says and when it shows; DzTooltip
where and how. A chart without this package ships none of DzTooltip.

```ts
import { dzTooltip } from '@dzgraph/dztooltip';
import '@dztooltip/theme/dztooltip.css';

chart(el, options, { types, features: [dzTooltip({ tone: 'info', placement: 'top', animation: 'morph' })] });
```

As every DzTooltip tooltip, a scroll of the page hides it.

See the [repository's README](https://github.com/plinthworks/dzgraph#readme). Licence: MIT.
