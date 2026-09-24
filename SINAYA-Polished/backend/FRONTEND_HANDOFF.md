# Backend handoff for the frontend

The authenticated local API now covers registration/catalogues, dedicated pond sensors, weather, historical assessments, reviewed action selection, localized advisories, optional AI wording drafts, and SMS simulation. It is implemented and tested offline; it is not a claim of live Supabase deployment, hardware validation, or validated predictive accuracy.

## Complete local setup

1. Fix `DATABASE_URL` in `backend/.env` and run `npm run db:check`.
2. Review all five SQL migrations (`0000` through `0004`) against the target database, then run `npm run db:migrate`.
3. Run `npm run db:seed`. This idempotently loads English, Filipino, Cebuano, three starter species, and equipment. It never approves safety rules or actions.
4. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` (a public publishable/anon key) in the backend. The backend verifies access tokens with Supabase Auth; there is no unauthenticated API fallback or password storage in SINAYA.
5. Run `npm run dev` from `backend`. The development server remains on `127.0.0.1:3030`. Allowed browser origins default to `http://localhost:5173` and `http://127.0.0.1:5173`; change `FRONTEND_ORIGINS` explicitly for another environment.
6. Implement the login/signup UI with Supabase Auth. Send its access token in `Authorization: Bearer ...` to SINAYA. Token refresh belongs in the frontend Supabase session integration. Do not put service-role/database/provider secrets in browser variables.

All `/api` routes require authentication. `/health` is public process liveness and `/ready` is public database/schema readiness; neither validates the user's Supabase Auth setup. API replies are `Cache-Control: no-store`. No public table policies were added to Supabase's Data API: domain access goes through the backend, using its configured PostgreSQL role.

`GET /api/auth/me` returns `{ data: { userId, operator } }`. If `operator` is null, POST `/api/farmers` once using the registration body in API.md. The backend binds the verified Auth user ID itself; clients cannot supply `authUserId`. A duplicate profile returns 409. Existing pre-auth operator rows stay unlinked. A trusted administrator may run `npm run db:link-user -- <operator-uuid> <verified-supabase-user-uuid>` after verifying the identity in Supabase; the command cannot overwrite existing links. There is no name/phone-based account claiming.

Operators can access only their own operator profile, farms, ponds, stocking cycles, contacts, sensors, readings, and assessments. List routes are scoped automatically and foreign resource IDs return 404. Inactive accounts cannot access domain routes. Farm contacts are notification recipients, not login identities. This does not implement a staff/admin permission hierarchy.

## End-to-end frontend sequence

1. Sign in, GET `/api/auth/me`, and complete operator registration if needed.
2. Read `/api/languages`, `/api/species`, `/api/equipment`; create a farm, pond, and stocking cycle. Choose language explicitly.
3. Register the pond's sensor, or POST clearly marked simulated readings for a demo. See SENSORS.md. Device labels are not cryptographic proof of physical-device origin; ingestion presently uses the operator's token.
4. GET `/api/ponds/:pondId/weather` and `/api/ponds/:pondId/readings/latest`. Show weather availability, sensor age, and source labels separately.
5. POST `/api/ponds/:pondId/assessments` with `{ "cycleId": "...", "source": "device", "availableEquipmentIds": [] }`. For demo readings, explicitly set `source` to `simulated`.
6. Read the resulting status/reasons. GET the collection for history or `/api/ponds/:pondId/assessments/:assessmentId` for a saved result.
7. POST `/api/ponds/:pondId/assessments/:assessmentId/advisories` with `{ "languageCode": "en" }`. The same assessment/language pair returns the stored advisory. GET that collection to list its advisories.
8. If an advisory is `ready`, POST `/api/ponds/:pondId/assessments/:assessmentId/advisories/:advisoryId/simulate` with `{}`. Display masked recipients and the `simulated: true` marker. No actual SMS is sent. Zero eligible recipients is a valid result; do not call it a sent alert.

The prepared `frontend/src/lib/api.ts` accepts a session-token getter and handles the JSON/error envelope. Its generic `request<T>` covers the existing foundation routes, and typed methods cover profile, farms, ponds, assessments, advisories, and simulation. It does not initiate requests or redesign the existing landing page. Set `VITE_API_BASE_URL` as needed. The login UI and screens still need to be built/wired in the frontend phase.

## Assessment semantics

| Status | UI meaning |
| --- | --- |
| `data_unavailable` | No fresh sample from the active sensor/source; no current threshold conclusion |
| `review_required` | No approved rule fits the species, density, and water environment |
| `within_reviewed_ranges` | Current values fit the configured reviewed ranges; not a safety guarantee |
| `watch` | Normal current readings but a reviewed weather-watch threshold is exceeded |
| `warning` | At least one current sensor threshold is breached |

Confidence is separate: `high` requires a breach plus elevated weather and complete selected forecast coverage; a breach without that corroboration remains `standard`. Missing weather does not suppress a valid breach. No agreement is inferred from unavailable/stale weather. A normal reading with incomplete weather is `limited`. The current implementation is deterministic, not a learned predictor; disagreements/availability and decisions are recorded in reasons and snapshots. The reviewed rule's weather thresholds must be reviewed for their role in this exact logic.

Each assessment saves its exact cycle, area/density, sensor reading, weather summary, selected rule/version, candidates, selected actions, source, and reasons. Weather snapshots are preserved inside assessments, not in a separate scheduled weather-observation stream. History is appended, not overwritten. Select the cycle explicitly for polyculture; one cycle assessment must not be displayed as covering other species/cycles in the pond. New assessments are explicit commands; a job scheduler is not implemented.

Equipment-dependent actions require a catalogue item both owned by the operator and explicitly confirmed available at this farm in `availableEquipmentIds`. Custom equipment is not guessed to be equivalent. Listed equipment options are alternatives (OR); an empty requirement list means no equipment requirement. Among applicable approved automatic actions, selection ranks effectiveness first, priority second, then a stable ID, and selects a feasible action per triggered risk. Effectiveness is a reviewer-supplied ranking score, not an empirical success percentage. Unselected stronger/unavailable candidates remain in the snapshot. Reviewers must account for restrictions and combinations before marking an action automatic-eligible.

## Human review and localization

There are no default approved thresholds/actions and no public approval endpoint. Until reviewed material is supplied, review-required behavior is expected and the system cannot truthfully generate an actionable automatic SMS. Automated tests use explicit synthetic fixtures that are never seeded into the application's database.

A trusted maintainer can import a versioned reviewed JSON file with `npm run db:import-guidance -- <file>`. See GUIDANCE_FORMAT.md. The importer validates shape/references and records reviewer attestation; it cannot independently certify a reviewer's qualifications or the scientific correctness of instructions. Use a new rule version for changes, retire obsolete versions, and never overwrite historical versions in place.

The final SMS uses exact approved English instructions or reviewed translated instructions. All non-English automatic messages require reviewed translations; Cebuano additionally requires native-speaker review in the importer. A missing translation yields `review_required` with no final text. It never silently substitutes English. Messages include DO, pH, temperature, and a simulated-data label when appropriate. Overlong messages (>480 characters) require review instead of truncating instructions. Delivery is always simulation regardless of data source.

Optional AI localization: POST the advisory's `/localization-draft` subroute with `{}`. This invokes the existing configured DeepSeek provider only for already selected instructions. The result is stored as `generatedText`/`generationStatus`, never as `finalText`. Provider failure sets `unavailable`; no credentials/errors are returned. A draft does not approve itself, cannot be simulated as final, and does not change readings/risk/actions. Human review and a newly versioned guidance import/new assessment are required before deploying new wording. No live AI calls were made by the test suite.

Simulation rechecks parent activity, current consent/language, action/rule approval, current wording, cycle status, freshness, and whether newer sensor data superseded the assessment. Old or changed conditions require a new assessment. Repeating a simulation does not duplicate the same advisory/recipient record. Same-phone recipients within one language are deduplicated for the current call. A new assessment/advisory is a new event. A full background queue, multi-message alert suppression policy, real SMS, and voice calls remain outside this showcase backend.

## Verification and remaining deployment work

Run `npm test` in `backend` to compile and run offline database, weather, HTTP, operator-isolation, and end-to-end workflow tests. No remote database, SMS, or AI service is used by those tests. The earlier read-only Open-Meteo sample request passed live verification.

Before a live pilot: resolve Supabase connectivity; apply reviewed migrations; seed catalogues; verify real Supabase login and PostgreSQL roles; load genuinely reviewed guidance; integrate/calibrate physical sensors and gateway authentication; agree sampling/staleness policy; validate thresholds, weather corroboration, action combinations, and delivery behavior with reviewers. Production hosting, abuse/rate limiting, monitoring, backups, predictive ML, voice delivery, and insurance/impact reporting are not claimed complete by this local backend handoff.
