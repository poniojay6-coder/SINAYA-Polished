# Save flow and sensor-free demonstrations

Local demo mode (`VITE_DEMO_MODE=true` in `.env.local`, development only) stores farms, ponds and stocking records in this browser. It does not save those records to Supabase. Register a pond, choose **Save pond · set up sensor later**, then **Open dashboard**. Select **Preview sample readings** to run a synthetic water-quality display updated every five seconds. Hiding samples or leaving the view stops the timer. Samples are not uploaded or used for alerts.

To use Supabase records, set `VITE_DEMO_MODE=false`, restart Vite, start the backend, and sign in with a confirmed Supabase account. Complete the operator profile, register a farm and pond, and open the dashboard. Refreshing loads the saved backend records. Both account and farm addresses use PSGC Cloud dropdowns; region changes clear dependent fields. PSGC names, not codes, populate the existing address columns.

Backend verification: `npm run build`, then `node tests/live-save-flow.mjs` from backend. This explicitly connects to the configured database, exercises operator/farm/pond/stocking creation and dashboard retrieval through Express, and rolls back its fixtures. Authentication is injected only inside the test process; this check does not test actual Supabase login/email confirmation or change the running server's authentication.

DeepSeek remains connected to the advisory translation-draft endpoint. Drafts are separate from reviewed final SMS wording. SMS delivery is currently a simulator, with no real message provider. The dashboard's synthetic preview does not invoke AI or SMS. Approved species thresholds and action instructions are still needed for advisories.
