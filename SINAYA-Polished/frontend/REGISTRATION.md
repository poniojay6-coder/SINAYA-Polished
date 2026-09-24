# Registration

## Temporary local demo

Set `VITE_DEMO_MODE=true` in `.env.local` and restart Vite to try signup and
pond registration without authentication. Demo farm, pond, stocking and sensor
records are stored only in this browser's localStorage, separately from Supabase.
Passwords are not stored or sent in demo mode. A banner identifies the mode.
Set `VITE_DEMO_MODE=false` and restart Vite to restore normal authentication.
Production builds always disable demo mode; backend authentication stays enabled.

Open `/#register` from Create Account on the landing page. `/#login` signs in
existing users and resumes incomplete operator setup.

## Configuration

Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` using the Supabase project URL and **public publishable
or anon key**. Never use a secret/service-role key in frontend configuration.
Restart Vite after changing the environment. The backend needs its matching
Supabase public configuration, database connection, and must be running on port
3030. Its allowed frontend origins must include the frontend address.

In Supabase Auth URL Configuration, allow these development redirect URLs:
`http://localhost:5173/**` and `http://127.0.0.1:5173/**`.
Set the Site URL to the address you actually use. Production needs its own exact
allowed origin. Email signup must be enabled. Preserve email confirmation.

## Flow and data

1. Account Access collects email/password, mobile number, region, province,
   city/municipality, and barangay. Contact/address details are carried in Supabase
   user metadata as a registration draft and restored for review in the operator
   form after confirmation. They are not authorization claims; the backend still
   validates the final profile payload. Email/password create a Supabase Auth account. Password confirmation stays
   only in the form and is not sent to the operator API.
2. When email confirmation is required, the page asks the user to confirm and
   sign in. PKCE confirmation links can restore the session in the same browser.
   If opened elsewhere, sign in manually after confirming.
3. After authentication, `/auth/me` checks whether an operator profile exists.
   Missing profiles open the operator form. Language choices come from the
   authenticated `/languages` catalog, never a hardcoded list.
4. `POST /farmers` sends firstName, lastName, mobileNumber, region, province,
   municipalityCity, barangay, preferredLanguageCode, smsConsent, and optional
   paired latitude/longitude. The backend assigns the authenticated user ID.
   IDs, status, and timestamps are not user inputs. SMS consent starts unchecked.
5. A success view appears only after the profile is saved (or an existing profile
   is verified). Backend outages leave a retryable incomplete registration;
   signing in later resumes setup. The success screen links to `/#register-pond`.

## Pond registration

`/#register-pond` requires an authenticated active operator profile. It selects
an existing active farm or creates one with its physical address, then saves
pond name, self-reported square-metre area, water type, and optional paired
coordinates. Coordinates are needed for weather, but do not block registration.
Species come from the database catalog. Quantity and stocking dates create a
historical stocking cycle; the server calculates density from the pond area.
The final step optionally assigns a dedicated sensor by serial number. Assignment
does not claim a working hardware connection or live readings.

New setup steps keep in-memory drafts until the final save. Back preserves inputs
and allows corrections before any records are created. Closing/reloading before
that save discards drafts. The final save creates records sequentially. After a
partial server save, Back is disabled and retry continues the remaining steps
without recreating acknowledged records. A confirmed pond ID is kept in session storage, scoped
to the operator, so refreshing the same tab resumes stocking/sensor setup from
server records without creating the pond again. A failed later step leaves earlier
records intact. No dashboard, physical gateway provisioning, or live SMS is added.

The fish supports click-to-follow, release, Escape, pause, and reduced motion.
The original landing fish artwork is shared by both pages.

Run `npm test`, `npm run build`, and `npm run lint` for local verification.
Auth tests use mocks and never create real Supabase users or send email.
