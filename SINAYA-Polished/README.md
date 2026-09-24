# SINAYA — Sensor Intelligence Network for Aquaculture Yield Analytics

An aquaculture early-warning and advisory prototype for medium-to-large Philippine fish and shrimp farms. The revised core combines dedicated per-pond sensors with weather forecasts. See [concept changes](CONCEPT_CHANGES.md) for the PDF-to-implementation mapping and phase boundaries.

The backend now implements authenticated registration, sensors, weather, stored assessments, reviewed-action advisories, optional localization drafts, and SMS simulation. Start with [the backend/frontend handoff](backend/FRONTEND_HANDOFF.md) for setup and outstanding live-deployment requirements. A frontend API client is prepared; the existing landing page is preserved until the UI phase.

## Projects

- `frontend/` — React + TypeScript + Vite frontend (existing code preserved; generated `dist/` and `node_modules/` removed).
- `backend/` — Node.js + TypeScript backend (existing DeepSeek/Copernicus code preserved and reorganized).

## Current backend direction

Prepared folders exist for:

- Supabase/PostgreSQL + future Drizzle schema/migrations
- farm operators, farms, designated contacts, ponds, stocking cycles
- tools/equipment and custom `Other` entries
- language and region-language recommendations
- dedicated per-pond sensor readings (DO, pH, water temperature)
- Open-Meteo weather
- preserved optional legacy Copernicus client, outside the revised core workflow
- fusion/confidence and per-pond risk
- vetted action library + effectiveness/feasibility ranking
- AI localization/translation; trend prediction only after sufficient pilot data and validation
- advisories and alerts
- **SMS simulation only for the showcase** (no paid SMS provider)
- farm-level dashboard/reports/simulator/settings (later phases)
- jobs, validators, middleware, tests

## Deliberately removed from this cleaned copy

- nested duplicate `src/Sinaya-Backend/`
- backend copies of frontend assets/components/pages/styles
- typo/obsolete `services/assesssment/`
- installed `node_modules/`
- generated frontend `dist/`
- `.git/` history from the uploaded copy
- `package.json.broken`
- real `.env` file / credentials

## Run existing code

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend connection/type checks:

```bash
cd backend
npm install
npm run typecheck
npm run test:connections
```

Copy `backend/.env.example` to `backend/.env` locally and fill in your own credentials. Do not commit `.env`.

## Important

The sensor phase now adds dedicated pond units and append-only reading ingestion, taking the local schema to twelve tables and three migrations. See [sensor routes and behavior](backend/SENSORS.md). Hardware integration and Supabase deployment remain pending; weather and risk logic are next phases. The paragraph below records the earlier foundation milestone.

Ten foundational tables and two migrations are prepared locally and tested with embedded PostgreSQL. They have not been applied to Supabase; live database tests remain pending the connection fix. See [backend database instructions](backend/README.md) for schema decisions and verification commands and [the foundation API](backend/API.md) for the implemented controllers, services, and validation. Run `npm run dev` from `backend` for the local API. Sensor/weather ingestion, risk formulas, and SMS behavior remain later phases. Predictive AI, voice/IVR, and a multi-pond dashboard are roadmap features.
