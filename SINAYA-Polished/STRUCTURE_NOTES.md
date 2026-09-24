# Structure changes made

Historical cleanup notes follow. The current farm-centered sensor + weather scope and subsequent schema changes are documented in [CONCEPT_CHANGES.md](CONCEPT_CHANGES.md). Satellite scaffolding remains legacy code, not a required MVP source.

## Preserved
- Existing frontend source and assets.
- Backend `config/env.ts`.
- DeepSeek client.
- Copernicus client and OAuth token service.
- Existing `testConnections.ts`.
- Empty `app.ts`, `server.ts`, `index.ts` for later wiring.

## Cleaned
- Removed duplicated nested `src/Sinaya-Backend/` tree.
- Removed backend-side duplicate frontend folders (`assets`, `components`, `pages`, `styles`).
- Removed obsolete misspelled `services/assesssment/`.
- Normalized middleware filenames to `errorHandler.ts` and `notFound.ts`.
- Separated backend into its own `backend/` folder.

## Added scaffolding
- Database/Drizzle folder structure.
- Domain service folders for farmer, pond, stocking, equipment, languages, sensors, weather, satellite, fusion, risk, action library, AI, advisory, alert, SMS simulator, dashboard, reports, simulator and settings.
- Validators, jobs, utilities and test folders.
- Supabase/Open-Meteo/SMS-simulation placeholders in `.env.example`.

## SMS showcase decision
No paid SMS API is included. The backend is prepared for an SMS simulation service only.
