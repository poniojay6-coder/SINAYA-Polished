# Open-Meteo weather integration

`GET /api/ponds/:pondId/weather` loads the pond's registered latitude and longitude, calls the weather service/provider, and returns `{ data: ... }`. Unknown ponds return 404; missing pond coordinates return 422. Coordinates cannot be overridden via query parameters. The sample Berlin coordinates are not used in application requests. Current localhost-only API restrictions still apply.

The fixed provider endpoint is `https://api.open-meteo.com/v1/forecast`. No API key or paid provider was added. The earlier `OPEN_METEO_BASE_URL` environment placeholder is not used; the URL is fixed to this provider. Provider request parameters follow the URL supplied by the user:

- Current: air temperature, precipitation, rain.
- Hourly: wind speed, gusts, direction, weather code, air temperature, rain, precipitation probability.
- Daily: apparent temperature min/max, maximum precipitation probability, rain sum, weather code, maximum wind speed/gusts.

Units are explicitly Celsius, millimetres, km/h, degrees, percent, and WMO codes. Three forecast days are requested in UTC with Unix timestamps. Daily dates are UTC calendar dates, not Philippine local-day totals. See [Open-Meteo documentation](https://open-meteo.com/en/docs). Apparent temperature means human feels-like temperature; it is not actual air temperature or pond-water temperature. Current data is provider-model weather, not a pond sensor measurement.

The response includes current values/units, three daily rows/units, the provider grid coordinates, attribution, retrieval time, and a compact next-48-hour summary. This horizon begins at the current UTC hour. Hourly arrays stay in the backend. Summary metrics include air-temperature min/max, rain total, maximum precipitation probability, and maximum wind/gust speed. Each metric includes its valid sample count; null values remain missing, never zero. Partial sums cover available samples only, not a guaranteed full horizon. `availableSamples` and `expectedSamples` expose horizon completeness. Wind direction and hourly WMO codes remain available in the internal provider result for later fusion work.

Successful responses cache by exact pond coordinates for 15 minutes, with concurrent requests coalesced and a 100-entry cache bound. Failures are retried after a one-minute cooldown. The last successful forecast may be returned as `stale` for up to one hour after retrieval; otherwise status is `unavailable` and forecast is null. `available` means a successfully retrieved forecast, not aquaculture safety or complete samples. Upstream non-success responses, invalid JSON/schema/units, and an eight-second timeout follow this same fallback. Errors and upstream response bodies are not leaked. Weather outages do not block sensor routes.

This phase provides forecast summaries, not validated low/moderate/high risk categories. Species thresholds, confidence fusion, historical weather snapshot persistence, background refresh, and alert generation are later work. The in-memory cache resets when the server restarts. No database migration is needed for this phase.

Validation commands:

```sh
npm run test:weather
npm run test:api
```

Tests inject forecast responses and failures; they do not use the live weather API. A separate read-only request to the live provider using the user's sample coordinates succeeded during implementation, returning 72 hourly samples and three daily rows. Supabase connectivity remains a separate outstanding setup task.
