# DEMO-03.5 Branding Persistence QA

Date: 2026-03-09  
Scope: verify branding changes persist after refresh and re-login, and propagate to portal + invite.

## Preconditions

1. Local app running (`npm run dev`).
2. Broker credentials configured in `.env.local`.
3. Broker can sign in at `/broker/sign-in`.

## Test Steps

1. Sign in as broker and open `/broker/settings`.
2. Change these fields to obvious temporary values:
   - `Sender Name`
   - `Logo URL`
   - `Primary Color`
   - `Secondary Color`
   - `Legal Footer`
3. Click `Save Branding` and confirm success message.
4. Hard refresh `/broker/settings` and confirm all new values still loaded.
5. Click `Open Client Portal` and verify:
   - portal header/logo reflects new value
   - color theme reflects new colors
   - legal footer reflects new text
6. In broker pipeline, create a test client (`Create Client + Send Invite`).
7. Open latest invite record from Mission Control/dev invites and verify email HTML reflects:
   - sender identity
   - logo (if configured URL is valid)
   - updated button/accent colors
   - updated legal footer
8. Sign out broker, sign back in, reopen `/broker/settings`, confirm values persist.

## Expected Result

All branding values persist across refresh and re-login and appear consistently in:

1. broker settings readback
2. client portal pages
3. invite email template

## Rollback (Optional)

After QA, restore production-safe branding values in `/broker/settings` and click `Save Branding`.
