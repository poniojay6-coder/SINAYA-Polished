# Database foundation

**Current entry point:** [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) describes the authenticated backend workflow, five migrations, catalogue seeding, reviewed guidance import, and frontend API client. All `/api` routes now require verified Supabase access tokens and operator ownership. Earlier phase notes below are historical; authentication is implemented, though live Supabase setup/verification remains outstanding.

The Open-Meteo provider and pond weather summary endpoint are implemented; see [WEATHER.md](WEATHER.md). No additional database migration is required for this integration.

Dedicated pond sensors and historical readings are now implemented locally. See [SENSORS.md](SENSORS.md). The current schema has twelve tables and three migrations, including `0002_pond_sensors.sql`; `/ready` requires that migration as well. Sensor and foundation HTTP tests pass offline. The original foundation details below describe the first two migrations.

The foundation HTTP controllers are now wired through Express with separate services and request validators. See [API.md](API.md) for routes, request bodies, local startup, and HTTP integration tests. The server binds to localhost while authentication remains a later phase.

Run commands from this `backend` directory. Existing AI and optional legacy satellite clients remain independent of database configuration. The current concept is sensor + weather monitoring for commercial farms; see [the concept revision](../CONCEPT_CHANGES.md).

1. Install dependencies with `npm install`.
2. Set `DATABASE_URL` in the existing local `.env` file using your Supabase PostgreSQL connection string. Do not commit credentials. Percent-encode special characters in the password and retain the provider's SSL settings. Use a direct connection or session pooler connection suitable for migrations.
3. Run `npm run typecheck` and `npm run db:check`.

The database check executes `SELECT 1` through Drizzle, closes its connection, and exits with a nonzero status on failure. It does not create or modify tables. Errors intentionally omit driver details to avoid exposing credentials. Check the URL, database availability, SSL settings, and network access if it fails.

## Foundation schema (prepared offline)

The schema entry point is `src/db/schema/index.ts`. It exports ten tables: languages, region_languages, species, equipment_catalog, farmers (operators), farmer_equipment, farms, farm_contacts, ponds, and stocking_cycles. Migrations are `0000_foundation.sql` followed by `0001_farm_centered_concept.sql` in `src/db/migrations`. Both have been reviewed and tested offline, but neither has been applied to Supabase by this task.

The second migration backfills one provisional farm per existing operator with ponds, preserves pond IDs and historical cycles, then replaces `ponds.farmer_id` with `ponds.farm_id`. Review imported farm names/locations and pond groupings before pilot use; the old schema did not distinguish farms. New pond inserts require `farmId`.

`npm run db:generate` works offline without credentials. Migration application uses `drizzle.migrate.config.ts`, which requires `DATABASE_URL`.

Once the database connection is fixed, run these in order:

```sh
npm run db:check
# Review BOTH migration files against the target database first.
npm run db:migrate
npm run db:smoke
```

The smoke check inserts synthetic records across all ten tables, reads them back, verifies historical density and selected constraints, and rolls back its fixtures. It has not yet run against Supabase. Use a backend database role that can access these tables.

Run `npm run test:db:offline` without credentials to test fresh installation, upgrade/backfill, constraints, and row-level security in an isolated embedded PostgreSQL database. This is not a substitute for checking the Supabase connection and deployment roles.

### Model decisions

- Languages, species, and equipment are database catalogues; no seed catalogue data has been loaded yet. Region-language entries suggest choices without setting a farmer's preference. `region_code` should use the application's canonical region identifier consistently.
- A farmer record represents a farm operator, who may own multiple farms with multiple ponds each. Farm addresses are separate from operator addresses. Shared mobile numbers are allowed. SMS consent defaults to false.
- Farm contacts have independent language, SMS consent, active status, and recipient selection. They default to not receiving alerts. `farms.notify_operator` defaults to true, but future delivery must still check operator consent and active status. These fields do not implement or authorize message sending.
- Cebuano (`ceb`, including `ceb-*`) requires native-speaker review. `requires_native_review` records this requirement, not content approval. Future localized content must have its own review/version record before deployment.
- Equipment rows contain either a catalogue ID or a nonempty custom name, never both. Custom entries do not modify the catalogue. Duplicate equipment per farmer is prevented; quantity represents multiple units.
- Areas are self-reported square metres, never satellite estimates. Each stocking cycle stores its area at stocking time; density is generated as quantity divided by that snapshot, in animals per square metre. Changing the pond area does not recalculate old densities. Create a new row for each new production cycle.
- Coordinates may be absent, but must be supplied as a valid pair when known. Water types are freshwater, brackish, or marine. Cycles are active, harvested, or cancelled; harvested cycles require an actual harvest date.
- Foreign keys restrict deletion of referenced records. Use inactive statuses for retired farmers, ponds, and catalogue entries. History is not cascade-deleted; preventing deliberate edits of past cycles belongs in future services.
- Row-level security is enabled without public policies. Browser clients cannot access tables by default; backend operations require an appropriate database role. User authentication and access policies are not implemented in this phase.
- `updated_at` defaults on insert and is refreshed by Drizzle updates. Raw SQL updates must set it explicitly; there is no database trigger.

Dedicated sensor units/readings, weather tables, vetted thresholds/action libraries, fusion/risk logic, AI localization, and simulated SMS remain later phases. Predictive AI requires pilot history and validation; voice delivery and a farm-level dashboard remain roadmap items. The foundation controllers do not expose these unimplemented services.

`npm run test:connections` checks the configured DeepSeek provider with a fixed acknowledgement prompt. It does not implement prediction or validated advice. Copernicus is skipped unless explicitly requested with `npm run test:connections -- --include-legacy-satellite`; its client and token cache are preserved.
