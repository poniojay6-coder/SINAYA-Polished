# Foundation HTTP API

**Current authentication contract:** every `/api` route requires a Supabase Bearer token and is scoped to its operator. See [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) for onboarding, CORS, assessments, advisories, localization drafts, and simulated deliveries. The unauthenticated description from the initial controller phase below is superseded.

Weather is now available at `GET /api/ponds/:pondId/weather`; see [WEATHER.md](WEATHER.md) for forecast fields, units, caching, and failure statuses. Historical weather persistence and risk assessment remain later phases.

This API exposes operators (`farmers`), farms, designated contacts, ponds, stocking cycles, equipment assignments, and read-only catalogues. The [dedicated sensor endpoints](SENSORS.md) register units and ingest historical readings, and the [weather endpoint](WEATHER.md) summarizes forecasts. Controllers handle HTTP and request validation; services enforce domain rules and query the injected Drizzle database or provider. No risk, AI, SMS, authentication, or dashboard controller is exposed yet.

## Run locally

From `backend`:

```sh
npm install
npm run dev
# Or: npm run build, then npm start
```

The server binds to `http://127.0.0.1:3030` (or the `PORT` in `.env`). Supabase Bearer authentication and operator ownership checks are enforced. The frontend UI is not wired yet; a client adapter and allowlisted browser CORS support are prepared. See FRONTEND_HANDOFF.md for the current setup.

`DATABASE_URL` must be syntactically valid to start. The server can start while the database host is unreachable: `/health` is liveness, while `/ready` checks access to the foundation schema and returns 503 when unavailable. No startup command applies migrations or seeds a remote database.

After fixing the connection, follow the migration instructions in `README.md`. Active language, species, and equipment catalogue rows must exist before registering records that reference them. There are intentionally no public catalogue mutation routes. Offline tests create synthetic catalogue data only in their isolated database; they do not seed Supabase.

## Request and response conventions

- Prefix domain routes with `/api`. POST/PATCH require `Content-Type: application/json`; bodies are limited to 32 KB.
- Unknown body/query fields, malformed IDs, empty updates, invalid dates, and wrong types are rejected. IDs are UUIDs. Supply mobile numbers as `+639XXXXXXXXX`.
- Numeric inputs use JSON numbers. Areas use square metres with at most two decimals. Coordinates use numeric latitude/longitude supplied or cleared together. PostgreSQL decimal values are returned as strings to retain precision.
- Dates use real calendar dates formatted `YYYY-MM-DD`. Timestamps are returned as ISO strings.
- Success: `{ "data": ... }`, with HTTP 201 for creation, 200 for reads/updates. List responses also include `pagination` with the parsed limit/offset and any applied filter.
- All lists default to `limit=25&offset=0`; limit is 1–100, offset is 0–1,000,000. Domain lists sort by ID (languages by code). No total-count query is performed.
- Errors: `{ "error": { "code": "...", "message": "..." } }`. Validation errors also have field issues. Statuses include 400 invalid input, 404 missing resource, 409 conflict/inactive record/closed cycle, 413 oversized body, 415 wrong content type, 422 inconsistent domain state, 503 database unavailable, and 500 unexpected failure. SQL and credentials are omitted.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process liveness; does not claim database readiness |
| GET | `/ready` | Database/schema readiness |
| GET, POST | `/api/farmers` | List/create operators; optional `accountStatus` list filter |
| GET, PATCH | `/api/farmers/:id` | Read/update an operator |
| GET, POST | `/api/farms` | List/create farms; optional `operatorId` list filter |
| GET, PATCH | `/api/farms/:id` | Read/update a farm |
| GET, POST | `/api/farms/:farmId/contacts` | List/create designated contacts for that farm |
| PATCH | `/api/farms/:farmId/contacts/:id` | Update a contact only within its own farm |
| GET, POST | `/api/ponds` | List/create ponds; optional `farmId` list filter |
| GET, PATCH | `/api/ponds/:id` | Read/update a pond |
| GET, POST | `/api/stocking-cycles` | List/create cycles; optional `pondId` list filter |
| GET, PATCH | `/api/stocking-cycles/:id` | Read a cycle; update expected harvest or close an active cycle |
| GET, POST | `/api/farmers/:farmerId/equipment` | List/assign operator equipment |
| PATCH | `/api/farmers/:farmerId/equipment/:id` | Update quantity of an existing assignment |
| GET | `/api/languages` | Active languages, including review requirement; optional `regionCode` filters suggestions |
| GET | `/api/species` | Active species catalogue |
| GET | `/api/equipment` | Active equipment catalogue |

## Bodies and business rules

An operator POST requires `firstName`, `lastName`, `mobileNumber`, `region`, `province`, `municipalityCity`, `barangay`, and `preferredLanguageCode`. Optional fields: `latitude`, `longitude`, `smsConsent`. PATCH accepts those fields plus `accountStatus` (`active`, `inactive`, `suspended`). A region suggestion never overwrites the chosen language.

A farm POST requires `operatorId`, `name`, and the four location fields above. Optional: coordinates and `notifyOperator`. PATCH accepts its editable fields plus `isActive`, but cannot transfer ownership by changing `operatorId`. An active operator is required to create or reactivate a farm.

A farm-contact POST requires `name`, `mobileNumber`, and `preferredLanguageCode`. Optional: `role`, `receivesAlerts`, `smsConsent`. PATCH also accepts `isActive`. The parent farm is taken from the URL and cannot be overridden in the body. Consent and recipient selection are separate; `receivesAlerts=true` is not authorization to send a message without consent. No messages are sent by these endpoints. Cebuano may be selected, but the review flag does not approve generated content for deployment.

A pond POST requires `farmId`, `name`, `areaM2`, and `waterType` (`freshwater`, `brackish`, `marine`). Coordinates are optional. PATCH also accepts `isActive`, but cannot change `farmId`. Creation/reactivation checks the farm and its operator. Area is self-reported.

Example stocking-cycle POST (use IDs returned by the API/catalogue):

```json
{
  "pondId": "<pond UUID>",
  "speciesId": "<species UUID>",
  "quantityStocked": 2000,
  "stockingDate": "2026-09-23",
  "expectedHarvestDate": "2027-02-01"
}
```

The service locks the pond while taking `stockedAreaM2` from its current registered area. Clients cannot supply density, the area snapshot, creation status, or timestamps. PostgreSQL calculates density. Pond-area changes later do not rewrite previous cycle density. Species and the pond/farm/operator must be active when opening a cycle. Multiple species/cycles can coexist; no unsupported single-cycle-per-pond restriction is assumed.

Cycle PATCH can change `expectedHarvestDate` (including clearing it with null), close as `cancelled`, or close as `harvested` with `actualHarvestDate`. Harvest dates cannot precede stocking. Closing locks the cycle in a transaction; subsequent updates receive 409. Species, pond, quantity, stocking date, and density snapshots are not editable through PATCH. New production requires a new cycle. Administrative historical corrections need a separate reviewed workflow.

Equipment POST accepts either `equipmentId` or `customName`, never both; `quantity` defaults to 1. PATCH accepts only a positive integer `quantity`. Duplicate assignments return 409. Custom tools never create catalogue entries. Equipment remains operator-owned inventory, not evidence that it is available at each farm.

Hard-delete routes are deliberately absent. Use active/account-status flags for operators, farms, contacts, and ponds; close stocking cycles without deleting history. Equipment removal and reassignment/ownership transfers are not implemented in this phase.

## Verification

```sh
npm run typecheck
npm run test:api
npm run test:db:offline
```

`test:api` compiles the TypeScript server, then exercises real Express handlers, services, and migrations against embedded PostgreSQL with Supertest. It does not use `.env` or contact Supabase, DeepSeek, Copernicus, or an SMS provider. Tests cover the registration flow, parent scoping, catalogues, equipment conflicts, density history, cycle closure, validation, and sanitized failure responses.
