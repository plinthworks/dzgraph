// Every feature's kit (ADR 0006), for tests of time axes and the navigator; and normalize() reading with it.
import type { Kit } from '../../src/kit.js';
import { timeKit } from '../../src/time.js';
import { navigatorKit } from '../../src/navigator.js';
import { normalize, type ReadContext } from '../../src/normalize.js';
import type { SeriesType } from '../../src/series-type.js';

export const FULL_KIT: Kit = { time: timeKit, navigator: navigatorKit };

export const normalizeFull = (options: unknown, types: readonly SeriesType[], context: ReadContext = {}) => normalize(options, types, { kit: FULL_KIT, ...context });
