# Farm dashboard

Open `/#dashboard`, or choose Open dashboard after pond registration.
Uses the landing page's navy/teal/mint design, existing logos, and fish companion.

The overview loads the operator, all farms, ponds, stocking cycles and species.
Search and farm filters control the pond cards and selected pond detail. Each pond
loads its latest device reading and most recent assessment. Failed individual
requests show unavailable states without hiding the remaining ponds.

Pond detail includes the latest DO/pH/water-temperature values, a parameter-selectable
chart of up to 48 device readings, recorded stocking cycles, and the next 48 hours
of weather when coordinates exist. Latest assessments are historical records;
the dashboard does not run assessments or claim that no alerts means safe water.
Refresh reloads the snapshot. There is no background polling in this version.

With VITE_DEMO_MODE=true in development, ponds come from this browser's demo
storage. No live weather or sensor readings are invented. Preview sample readings
creates an explicitly labeled, temporary synthetic chart for the selected pond.
It neither writes readings nor generates alerts. Production builds cannot enable
this demo mode. Different browsers/origins have separate demo records.

Verification: frontend build/lint and Vitest tests cover empty states, filters,
partial reading failures, and showing/hiding synthetic chart data.
