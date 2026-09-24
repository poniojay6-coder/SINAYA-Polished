# Reviewed guidance import format

Use `npm run db:import-guidance -- path/to/reviewed-guidance.json` only for guidance actually reviewed by a qualified person. This is a privileged backend command, not an operator API. It inserts one rule version and its actions in a transaction; conflicts or errors roll back the whole import. It does not update existing rule versions. No real threshold example is supplied because numeric values must come from the reviewer.

The JSON object's required fields are:

- `reviewedBy`: reviewer identifier/name (nonempty).
- `reviewedAt`: ISO timestamp with timezone, not in the future.
- `rule`: object with all fields below.
- `actions`: array of action objects (may be empty while a reviewer prepares guidance).

`rule` fields:

| Field | Meaning |
| --- | --- |
| `speciesId` | Existing catalogue UUID |
| `waterType` | `freshwater`, `brackish`, or `marine` |
| `version` | New positive integer for this species/environment |
| `densityMin`, `densityMax` | Inclusive applicability range in animals/m² |
| `doMin` | DO lower bound in mg/L |
| `phMin`, `phMax` | Inclusive pH range |
| `temperatureMin`, `temperatureMax` | Inclusive pond-water range in °C |
| `weatherRainWatchMm` | Rain-total watch threshold for the forecast window |
| `weatherHeatWatchC` | Maximum forecast AIR-temperature watch threshold, not apparent temperature |
| `weatherWindWatchKmh` | Maximum forecast gust watch threshold in km/h |

Each action has `riskType` (`low_oxygen`, `ph`, `temperature`, `weather_watch`), `instruction` (reviewed English, at most 350 characters), `effectiveness` (integer ranking score 0–100), `priority` (integer; default 0), and explicit `automaticEligible` (boolean). Do not mark restricted/manual actions automatic-eligible unless the reviewer has determined this rule's species/environment/density context and action combinations are sufficient for safe automatic selection.

Optional `equipmentIds` is an array of existing catalogue UUIDs interpreted as alternatives (any one required); empty means no equipment requirement. Do not use this field to express a requirement for several tools together.

Optional `translations` is an array of `{ languageCode, instruction, reviewedBy, nativeSpeakerReviewed }`. The importer requires `nativeSpeakerReviewed: true` for languages marked as requiring native review. Each translation inherits the import review timestamp. Reviewed translation records enable automatic localized wording; generated AI drafts do not.

Malformed ranges are rejected by database constraints. Review details are an administrator's attestation, not automatic scientific verification. Never copy the synthetic rules from automated tests into a real deployment.
