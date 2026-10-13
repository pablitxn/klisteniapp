<a id="dashboard-personal"></a>
# Personal dashboard

The **Mi salud** summary uses account data already loaded. It sends no data,
records no usage events and configures no watch connection. Umami still receives
only the consented, sanitized visit; personal charts are independent of telemetry.

<a id="lectura-de-los-gráficos"></a>
## Reading the charts

- **Period:** 7, 30 or 90 calendar dates, including today in the account timezone.
  This filters the dashboard; goals retain their start date and recent records
  show the entire history. Date arithmetic avoids shifting the range at daylight
  saving transitions.
- **Body:** select a measurement and source/device. Each point is that date's last
  observation, ordered by actual instant, without interpolating missing days.
  Change compares the first and last observed dates in the period, not an invented
  starting observation. One point produces no change. The labeled vertical scale
  fits the values; kg, cm and percentages never share an axis.
- **Rest:** hours by waking date and average over usable days. Overlaps are detected
  before clipping the period to retain boundary conflicts. Ambiguous nights are
  excluded and remain visible for review; missing observations are not zero hours.
- **Consistency:** distinct dates with Klisteni strength sessions. Two sessions on
  one day count once. Imported activity does not count as another session. The
  calendar shows recorded activity, not absence of exercise outside the platform.
- **Meals:** sums of present fields and the number of records contributing each
  nutrient. Missing fields do not become zero; a recorded zero counts. This is
  neither a complete daily average nor an estimate of a deficit.
- **Supplements:** records marked taken/not taken, grouped by name, and dates with
  notes. No dose, prescription or adherence percentage without a defined plan.
- **Coverage:** count and last observation date for each category in the period.
  An observation date does not establish recent synchronization.

Sources are those declared in each record. Body-source filters avoid accidentally
comparing different devices but do not authenticate imported data. Nutrition totals
describe existing records; correct duplicate entries for the same meal first.

<a id="interfaz-y-verificación"></a>
## Interface and verification

React retains controls and temporary selection; a pure helper transforms data and
two SVG charts draw points/bars. Sensitive selections are not stored in URLs or
localStorage. Expandable tables expose dates and values without relying on hover,
color or precise touch. Narrow screens use one column; no animation or additional
chart library is required.

```sh
pnpm --filter @klisteniapp/b2c-web exec node --test test/health-dashboard.test.ts
pnpm --filter @klisteniapp/b2c-web typecheck
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.health.config.ts
```

Domain tests cover calendar/daylight saving boundaries, two daily sessions,
ambiguous sleep across the range boundary, missing/zero nutrients, separate sources
and timestamp ordering with offsets. The browser journey checks period/source/
measurement filters, tables and mobile layout with a simulated account. Values
are test fixtures, not user data. Filters are read-only.

Automatically connecting new observations still requires implementation and
validation of the [Android bridge and synchronization protocol](health-sync.md).
The interface explicitly states this limit.
