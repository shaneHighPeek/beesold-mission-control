# BeeSold x Klor Integration Contract (v1)

Last updated: 2026-02-20  
Owner: BeeSold Engineering  
Consumer: OpenClaw/Klor system

## 1) Purpose

Klor connects to BeeSold to run automated post-intake processing on a client session.

In v1, Klor performs:

1. Klor synthesis trigger
2. Council/report generation trigger
3. Session signal ingestion via BeeSold API (no direct Supabase access)

BeeSold controls intake + workflow state.  
Klor only calls approved machine endpoints with API-key auth.

## 2) BeeSold Workflow Context

BeeSold intake flow summary:

1. Client is created and invited.
2. Client completes intake form and uploads files.
3. Session reaches `FINAL_SUBMITTED`.
4. Klor is triggered.
5. Council/report run is triggered.
6. Session reaches `REPORT_READY` for operator approval.

Klor should only start when BeeSold session is in `FINAL_SUBMITTED`.

## 3) Environments and Base URL

Klor must target the BeeSold server base URL.

Examples:

- Local dev: `http://localhost:3000`
- Production: your deployed BeeSold domain (for example `https://app.beesold.com`)

Base URL is provided by BeeSold ops/development team per environment.

## 4) Authentication

Klor authenticates with header `x-klor-api-key`.

BeeSold validates against env var:

`KLOR_SYSTEM_API_KEYS=key1,key2,...`

Required headers for machine calls:

- `Content-Type: application/json`
- `x-klor-api-key: <KLOR_KEY>`

If key is invalid or missing, BeeSold returns `401`.

## 5) Endpoints (Klor -> BeeSold)

## 5.0 Get Session Data (Signals)

`GET /pipeline/session-data/{sessionId}`

Optional query param:

- `updatedSince=<ISO-8601 datetime>`
- Example: `?updatedSince=2026-02-20T04:12:00.000Z`

Purpose:

- Retrieve intake data and uploaded asset metadata for Klor analysis.
- Keep data access constrained to BeeSold API boundary.

Headers:

- `x-klor-api-key: <KLOR_KEY>`

Success response shape:

```json
{
  "ok": true,
  "data": {
    "session": {
      "id": "UUID",
      "status": "FINAL_SUBMITTED",
      "currentStep": 7,
      "totalSteps": 7,
      "completionPct": 100,
      "missingItems": []
    },
    "brokerage": {
      "id": "UUID",
      "slug": "off-market-group",
      "name": "Off Market Group"
    },
    "client": {
      "id": "UUID",
      "businessName": "Example Venue Pty Ltd",
      "contactName": "Example Owner",
      "email": "owner@example.com"
    },
    "steps": [
      {
        "stepKey": "step_1_asset_snapshot",
        "title": "The Asset Snapshot",
        "order": 1,
        "isComplete": true,
        "data": {}
      }
    ],
    "assets": [
      {
        "id": "UUID",
        "category": "FINANCIALS",
        "fileName": "P&L FY2025.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 128932,
        "revision": 1
      }
    ],
    "delta": {
      "updatedSince": "2026-02-20T04:12:00.000Z",
      "filtered": true
    }
  }
}
```

Filtering behavior:

- If `updatedSince` is provided, BeeSold returns only steps/assets updated after that timestamp.
- `session`, `brokerage`, and `client` blocks are always returned for context.
- Invalid datetime returns `400` with error message.

## 5.1 Start Klor Synthesis

`POST /pipeline/klor-run`

Request body:

```json
{
  "sessionId": "UUID"
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "jobId": "UUID"
  }
}
```

Validation:

- Session must exist.
- Session must be `FINAL_SUBMITTED`.

## 5.2 Start Council Run

`POST /pipeline/council-run`

Request body:

```json
{
  "sessionId": "UUID"
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "jobId": "UUID"
  }
}
```

Validation:

- Session must exist.
- Session should be in `KLOR_SYNTHESIS` (set by step 5.1).

## 6) How Klor Gets `sessionId`

Klor can receive `sessionId` from BeeSold via either:

1. Upstream integration payload (recommended).
2. Onboarding API/webhook response when a client is created.
3. Operator-provided handoff from Dashboard during early rollout.

`sessionId` is the single identifier Klor must store per run.

## 7) Activation Rules

Klor activation policy for v1:

1. Pull signals with `GET /pipeline/session-data/{sessionId}`.
2. Wait until BeeSold session status is `FINAL_SUBMITTED`.
3. Call `POST /pipeline/klor-run`.
4. On success, call `POST /pipeline/council-run`.
4. Stop and flag for review on any non-2xx response.

Do not run pipeline endpoints for sessions not yet finalized.

## 8) Error Handling + Retries

BeeSold error shape:

```json
{
  "ok": false,
  "error": "message"
}
```

Retry policy:

1. Retry only for transient errors (`429`, `500`, `502`, `503`, `504`).
2. Exponential backoff: 2s, 5s, 15s, 30s, 60s.
3. Max 5 attempts per step.
4. No retry for `400`/`401`/`403`/`404`/`422` (configuration or state issue).

## 9) Operational Security Notes

1. Store Klor API key in secure secret storage only.
2. Never log full API key.
3. Rotate key if exposed.
4. Use separate keys per environment (dev/stage/prod).

## 10) Optional Webhook Inbound (Non-Klor Pipeline Auth)

BeeSold also supports protected webhook ingestion:

`POST /api/webhooks/client-intake`

Header required:

`x-beesold-webhook-secret: <WEBHOOK_SHARED_SECRET>`

This is separate from Klor machine pipeline auth and should use a different secret.

## 11) Quick Test Commands

```bash
BASE_URL="http://localhost:3000"
KLOR_KEY="your-klor-api-key"
SESSION_ID="your-session-id"

curl -s -X POST "$BASE_URL/pipeline/klor-run" \
  -H "Content-Type: application/json" \
  -H "x-klor-api-key: $KLOR_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"

curl -s -X POST "$BASE_URL/pipeline/council-run" \
  -H "Content-Type: application/json" \
  -H "x-klor-api-key: $KLOR_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"

curl -s "$BASE_URL/pipeline/session-data/$SESSION_ID" \
  -H "x-klor-api-key: $KLOR_KEY"

curl -s "$BASE_URL/pipeline/session-data/$SESSION_ID?updatedSince=2026-02-20T04:12:00.000Z" \
  -H "x-klor-api-key: $KLOR_KEY"
```

## 12) Current Role Permissions (v1)

1. `ADMIN`: full Dashboard + protected operator actions.
2. `EDITOR`: read-focused Dashboard access.
3. `KLOR_SYSTEM`: pipeline execution via API key on machine endpoints only.
