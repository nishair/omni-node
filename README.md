# Shoreline Weather Stations

A small React dashboard over public sensor datasets with a device dimension. Two regions ship,
switchable in the header (the choice lives in the URL hash):

- **San Francisco Bay** (default, `#sfbay`): the NOAA CO-OPS tide and weather station at
  [Alameda](https://tidesandcurrents.noaa.gov/stationhome.html?id=9414750) plus its three nearest
  Bay stations (San Francisco, Richmond, Redwood City). Air and water temperature, wind, pressure
  and water level.
- **Chicago lakefront** (`#chicago`): the Chicago Park District's three automated beach weather
  stations, from the
  [Chicago Data Portal](https://data.cityofchicago.org/Parks-Recreation/Beach-Weather-Stations-Automated-Sensors/k7hf-8y75).
  Air temperature, humidity, wind, pressure, rain and battery.

Each region shows, scoped by one station filter over the last 14 days:

- **Four metric tiles**, defined per region (for the Bay: latest air and water temperature with
  24-hour deltas, 24-hour tidal range, and reporting completeness).
- **One time-series chart** of hourly readings per station, switchable between metrics. Hours
  with no reading show as gaps.
- **One breakdown**: share of windy hours by compass sector.
- **A per-station table** with the latest reading and a reporting / stale / silent status.

## Run it

```sh
npm install
npm run dev
```

The app queries each API directly from the browser (no keys needed). If a request fails, it falls
back to the bundled snapshot in `public/data/<region>.json`. Refresh both snapshots with:

```sh
node scripts/fetch-snapshot.mjs 14
```

## Structure

```
src/
  data/types.ts       Source, Station, Reading, MetricDef and TileSpec contracts
  data/fetch.ts       live fetch with snapshot fallback
  data/compute.ts     window, tiles, hourly series, wind sectors, station health
  data/format.ts      number and date formatting
  sources/chicago.ts  Socrata query, parser, stations, metrics and tiles for Chicago
  sources/sfbay.ts    NOAA CO-OPS queries, parser, stations, metrics and tiles for the Bay
  hooks/              useReadings (per source), useHash (region routing)
  components/         StatTiles, TimeSeries, WindBreakdown, StationFilter, StationTable, ChartTooltip
  styles.css          design tokens (light and dark), layout, chart chrome
```

Adding a region means adding one file under `src/sources/` that implements `Source` and
registering it in `src/sources/index.ts`. The dashboard itself is generic.

## Notes on the data

- Both APIs publish station-local wall-clock times without a zone. They are parsed as browser-local
  time, so hour labels are exact only when viewed in the station's own time zone.
- The 14-day window is anchored to the newest reading in the data, not to the clock, so a snapshot
  renders identically to live data. Readings before the window start are dropped.
- NOAA water level arrives every 6 minutes; it is averaged into hourly values. The snapshot script
  stores those hourly means to keep the file small.
- Station colors are fixed by station, not by position, so changing the filter never recolors a line.
