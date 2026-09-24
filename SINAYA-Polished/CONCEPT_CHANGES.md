# Revised SINAYA concept

Source: `SINAYA_Concept_Overview-1.pdf`, supplied by the user, reviewed 2026-09-23. This records implementation decisions from the concept; the PDF's market statistics and citations have not been independently fact-checked. Its open sign-off questions are not treated as settled decisions.

## Current direction

Working name: **SINAYA — Sensor Intelligence Network for Aquaculture Yield Analytics** (PDF title; final naming remains open in Appendix A).

The target customer is a medium-to-large commercial Philippine fish or shrimp farm operator. The proposed business model is direct subscription or hardware plus service. Billing is not part of the current implementation. BFAR, cooperatives, and barangays are potential channel/data partners, not recipients of a new government or cooperative dashboard.

The core sources are **dedicated per-pond sensors plus weather forecasts**. Satellite observations are no longer a required source. Each pond will have its own continuously logging DO/pH/water-temperature sensor unit, maintained by the operator and reporting through a shared farm gateway/server. A shared gateway does not mean a shared or rotated sensor. Pond area is reported during registration, not estimated from imagery.

## Implemented in this revision

| Concept change | Implementation |
| --- | --- |
| Farm-centered operation (sections 5, 6, 9) | Keep `farmers` as operator identities. Add `farms`, each owned by an operator. Change ponds to reference a farm. One operator can have multiple farms, each with multiple ponds. |
| Operator and/or designated contact (section 3) | Add `farm_contacts` with language choice, SMS consent, active status, and alert-recipient preference. `farms.notify_operator` records whether the operator is included. These are settings only; no delivery service is implemented. |
| Cebuano native-speaker review (section 7) | Add `languages.requires_native_review`; enforce it for `ceb` and `ceb-*` language codes. This is a review requirement, not proof that any translation was reviewed. Existing Cebuano records are marked during migration. |
| Remove satellite from the core loop (sections 2–3) | Preserve Copernicus clients and token caching, but make the external connection diagnostic opt-in with `--include-legacy-satellite`. No satellite tables are added. |
| Updated public framing | Revise the existing landing-page copy to describe commercial farms, dedicated pond sensors, reviewed guidance, and the predictive roadmap. Preserve layout and interactions. |
| Safe AI boundary (section 7) | Change the DeepSeek connectivity prompt to a fixed acknowledgement instead of generating unreviewed aquaculture advice. The provider itself is unchanged. |

Equipment remains an operator-owned inventory (`farmer_equipment`), including custom tools. This preserves the previous requirement without assuming that owning equipment proves it is physically available at every farm. Availability and location checks belong in the later action-selection service.

### Migration behavior

Keep `0000_foundation.sql` intact and apply `0001_farm_centered_concept.sql` afterward. The second migration adds farm/contact tables, introduces the review flag, and replaces `ponds.farmer_id` with `ponds.farm_id`. It preserves each pond's ID and links its ownership through the new farm. Stocking cycles and equipment remain attached to their original records.

If old ponds exist, the migration creates one provisional `Imported farm - ...` per operator with ponds, initially copying the operator's location. The old model cannot reveal the actual grouping into physical farms. Review those imported names and addresses and regroup ponds before pilot use. Operators with no ponds do not receive an invented farm. New registrations must explicitly create their farm and supply its location.

This is a schema/API contract change: pond inserts use `farmId`, and operator lookup joins `ponds -> farms -> farmers`. The subsequent controller phase implements this contract in the [foundation HTTP API](backend/API.md); the existing frontend registration flow is not wired to it yet.

## Requirements for the next phases, not implemented here

### Per-pond environmental data

Add dedicated pond sensor units/readings and weather observations after the database foundation is verified. Readings must have an unambiguous pond and sensor identity, timestamps, units, and quality/staleness information. Retain history. A gateway may serve multiple units but must never substitute one pond's measurements for another's. Model replacements without losing the original sensor/pond attribution of past readings.

The revised loop is:

`pond sensors + weather -> fusion/confidence -> vetted species thresholds -> optional validated trend flag -> reviewed action selection and equipment feasibility -> requested language/localization -> validation -> simulated SMS`

Species, density, and pond characteristics affect urgency and applicability without changing the measured values. Lower source availability or stale/invalid readings must change confidence and be visible; missing weather must not suppress a valid threshold-breach alert.

### Alert confidence and urgency (section 4)

| Signals | Intended outcome |
| --- | --- |
| Valid sensor threshold breach plus corroborating weather | High-confidence alert |
| Valid sensor threshold breach without weather corroboration | Standard-confidence alert; still issue the alert |
| Elevated weather risk with valid, still-normal sensor readings | Lower-urgency Watch notice |
| Conflicting or unavailable signals | Explicit uncertainty and availability information, never manufactured agreement |

Confidence is separate from urgency. An urgent direct sensor breach does not become harmless because weather is unavailable. Exact thresholds, freshness limits, and scoring require human review; no numeric risk thresholds were invented from this PDF. Low oxygen/turnover is the suggested first risk type.

### AI and action review (sections 7, 10, 11)

The human-reviewed action library and vetted species-specific thresholds remain the sources of safety-critical guidance. A separate future predictive model may use accumulating per-pond history to flag deterioration before threshold breaches. It must remain unavailable until sufficient pilot data and validation exist; DeepSeek connectivity is not evidence of predictive capability. The PDF provides no minimum dataset or validated accuracy/lead-time target, so none is claimed.

AI localization may translate, simplify, personalize, and frame urgency already determined by the system. It must not invent actions, modify readings, override reviewed guidance, or silently decide safety-critical urgency. Future Cebuano advisory/template versions need a native-speaker review record before deployment. The language-level flag alone cannot approve generated text. English, Filipino/Tagalog, and Cebuano are the initial language targets; preferences remain explicit choices, including for staff contacts.

### Delivery and additional features

SMS remains simulated under the user's existing showcase constraint. Voice/IVR is a future optional channel; no paid SMS/voice provider is added. Delivery must check farm/operator/contact active status, recipient selection, language, and each recipient's consent; operator consent does not extend to staff. Deduplicate recipients as appropriate without silently replacing language preferences.

The PDF lists a farm-level multi-pond dashboard, feedback on whether guidance helped, feeding advisories, seasonal calendars, storm playbooks, impact reporting, and insurance documentation. They remain subsequent or potential features, not all required in this schema revision. The dashboard is for one operator's farms, not an LGU/cooperative broadcast system. The PDF explicitly makes the dashboard and AI prediction fast-follow items, and insurance documentation a roadmap item rather than a confirmed revenue source.

## Validation and boundaries

`npm run test:db:offline` uses embedded PostgreSQL (PGlite) with no credentials or network. It applies both migration files on a fresh database and upgrades representative pre-revision data. It checks ownership/history preservation, multiple farms, contact defaults, review flags, constraints, and restricted public table access. This does not validate Supabase connectivity, production roles, or hardware.

Live migration application and `npm run db:smoke` remain pending the Supabase hostname fix. No remote tables were changed during this revision. No risk engine, sensor ingestion, prediction model, voice service, paid provider, or dashboard was implemented.
