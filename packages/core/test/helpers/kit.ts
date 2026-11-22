// Every feature's kit (ADR 0006), for tests of time axes and the navigator; and normalize() reading with it.
import type { Kit } from '../../src/kit.js';
import { timeKit } from '../../src/time.js';
import { navigatorKit } from '../../src/navigator.js';
import { crosshairKit } from '../../src/crosshair.js';
import { compareKit } from '../../src/compare.js';
import { selectionKit } from '../../src/selection.js';
import { aggregationKit } from '../../src/aggregation.js';
import { normalize, type ReadContext } from '../../src/normalize.js';
import type { SeriesType } from '../../src/series-type.js';

export const FULL_KIT: Kit = { time: timeKit, navigator: navigatorKit, crosshair: crosshairKit, compare: compareKit, selection: selectionKit, aggregation: aggregationKit };

export const normalizeFull = (options: unknown, types: readonly SeriesType[], context: ReadContext = {}) => normalize(options, types, { kit: FULL_KIT, ...context });
