# DEMO-07.1 Walkthrough Script (5-10 min)

Audience: white-labeled broker stakeholder
Goal: prove broker can run intake flow end-to-end without BeeSold operator intervention.

## Prep (before call)

- Confirm broker login works at `/broker/sign-in`.
- Confirm at least 3 test clients exist across statuses.
- Keep one fresh client ready for "create + invite" action.

## Live flow

1. Broker sign-in
- Open `/broker/sign-in`.
- Log in with broker email/password.
- Confirm tenant-only access to broker pipeline.

2. Pipeline and timers
- Open `/broker/pipeline`.
- Show kanban columns by lifecycle.
- Open one card and call out `Time in system` + `Time in stage`.

3. Add client with template selection
- In `Add Client`, complete minimal fields.
- Set `Listing Type` to `Commercial Property (6-phase)`.
- Click `Create Client + Send Invite`.
- Confirm success message and new card in pipeline.

4. Branding and domain controls
- Open `/broker/settings`.
- Show logo/colors/sender settings.
- Show custom domain + sender domain verification status blocks.

5. Intake portal experience
- Use magic link/new invite for created client.
- Confirm 6-phase commercial form loads (not OMG 7-step).
- Save one phase and resume to prove persistence.

6. Final submit control
- Attempt final submit with missing required commercial uploads.
- Show validation blockers.
- Add required uploads and submit final.

7. Mission Control parity
- Open Mission Control intake list.
- Confirm same client/session appears with correct status.

## Close

- Reconfirm BeeSold is master system of record.
- Reconfirm broker portal and Mission Control are two views of one shared data model.
