# Dedicated pond sensors

The sensor phase adds `sensor_units` and `sensor_readings`, migration `0002_pond_sensors.sql`, a sensor service/controller, and local HTTP routes. Apply the three reviewed migrations in order only after the Supabase connection works. No remote migration has been applied by this phase.

## Routes

All writes use JSON. IDs are UUIDs. Existing localhost-only, unauthenticated development restrictions still apply.

| Method | Path | Body or query |
| --- | --- | --- |
| POST | `/api/ponds/:pondId/sensors` | `{ "serialNumber": "POND-01-UNIT-01" }` |
| GET | `/api/ponds/:pondId/sensors` | `limit`, `offset`; includes retired units |
| POST | `/api/ponds/:pondId/sensors/:id/retire` | `{}` |
| POST | `/api/sensors/:id/readings` | Reading body below |
| GET | `/api/ponds/:pondId/readings` | `source=device` or `source=simulated`, `limit`, `offset` |
| GET | `/api/ponds/:pondId/readings/latest` | `source=device` or `source=simulated` |

Example reading (choose an actual past observation time):

```json
{
  "observedAt": "2026-09-23T08:00:00.000Z",
  "source": "simulated",
  "dissolvedOxygenMgL": 5.2,
  "ph": 7.5,
  "waterTemperatureC": 29
}
```

Source is mandatory on ingestion. Queries default to `device` and never silently substitute simulation. A `device` label is a caller declaration in this local prototype, not verified hardware provenance. Device authentication and gateway protocols must be implemented before deployment.

## Behavior

- One active unit per pond, enforced by a database unique index. Units have globally unique, case-sensitive serial numbers. Assignment is permanent through this API. Retire a unit before registering its replacement; no reassignment or reactivation route exists.
- Registration and ingestion require an active pond, farm, and operator. Retirement is scoped to the supplied pond and remains available when a parent is inactive.
- History is append-only through the API. There are no update/delete routes for samples. The database uses restrictive foreign keys; privileged SQL users are not prevented from editing data by an immutability trigger.
- The pond comes from the registered sensor, never a caller-supplied pond ID in the reading. Retired units preserve that association.
- Each sample stores observation time and server receipt time separately. UTC/offset timestamps are required, future samples are rejected, and older backfilled samples are accepted. Timestamp precision is milliseconds through the JS API. Synchronize device clocks; no future-clock tolerance is assumed yet.
- Exact retries with the same sensor, source, timestamp, and values return 200 with `duplicate: true`. A first insert returns 201. Changed values for an existing sample return 409; stored history is not overwritten. Ingestion/retirement are serialized by a sensor-row lock.
- Required finite JSON numbers have preliminary ingestion envelopes: DO 0–100 mg/L, pH 0–14, temperature -5–60 °C. Missing or out-of-envelope readings return 400 and are not stored. These broad development bounds are not safe/unsafe aquaculture thresholds or a calibrated sensor specification; confirm them with the selected hardware before pilot use.
- History includes retired sensors, ordered by observation time descending. Latest status uses only the active unit and the requested source. A replacement unit does not inherit its predecessor's latest reading.
- Latest status is `no_sensor`, `missing`, `stale`, or `fresh`, with `checkedAt`, `ageSeconds`, `staleAfterSeconds`, and the original reading. The development cutoff is 900 seconds, based on observation time, including the boundary. Change `STALE_AFTER_SECONDS` in the service after agreeing the hardware sampling cadence. Freshness describes data age, not water safety, calibration, connectivity, or farm operational status.
- Sensor tables have row-level security enabled without public policies, consistent with the foundation tables. No frontend, alert, risk, scheduled polling, or physical gateway integration is added here.

## Verification

`npm run test:api` applies all three migrations in embedded PostgreSQL and exercises registration, source separation, exact/conflicting retries, out-of-order arrivals, invalid/future readings, freshness, retirement, replacement, and preserved history. Existing foundation HTTP tests run alongside it. No Supabase credentials or hardware are used.

`GET /ready` now requires both the foundation and sensor schema. The next development phase can add the weather provider; live sensor hardware and Supabase verification remain outstanding.
