# BeeSold x Klor Integration Contract (v1)

Last updated: 2026-02-20  
Owner: BeeSold Engineering  
Consumer: OpenClaw / Klor

## 1) Objective

Define the machine-to-machine contract for Klor to ingest finalized BeeSold listing intake data and execute the pipeline stages that produce `REPORT_READY`.

This contract is for API alignment and production execution behavior.

## 2) Production Base URL

Use this base URL for production:

- `https://app.beesold.hpp-cloud.com`

All endpoint paths below are relative to that base URL.

## 3) Authentication Model

Klor authenticates with:

- Header: `x-klor-api-key: <KLOR_KEY>`

BeeSold validates keys against:

- `KLOR_SYSTEM_API_KEYS` (server env var, comma-separated supported)

Required request headers:

- `Content-Type: application/json` (for POST)
- `x-klor-api-key: <KLOR_KEY>`

If key is missing/invalid, BeeSold returns `401`.

## 4) State Model (Pipeline-Relevant)

Klor must follow BeeSold state gating:

1. Intake completes -> `FINAL_SUBMITTED`
2. Klor trigger -> `KLOR_SYNTHESIS`
3. Council trigger -> `COUNCIL_RUNNING`
4. Report generation complete -> `REPORT_READY`

Klor must **not** run synthesis before `FINAL_SUBMITTED`.

## 5) Endpoints

## 5.1 Get Session Signals

`GET /pipeline/session-data/{sessionId}`

Optional query:

- `updatedSince=<ISO-8601 UTC timestamp>`
- Example: `?updatedSince=2026-02-20T04:12:00.000Z`

Purpose:

- Retrieve listing intake signals (steps + uploads metadata) without direct DB access.

Success response:

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
      "missingItems": [],
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    },
    "brokerage": {
      "id": "UUID",
      "slug": "off-market-group",
      "name": "Off Market Group",
      "shortName": "OffMarket"
    },
    "client": {
      "id": "UUID",
      "businessName": "Example Venue Pty Ltd",
      "contactName": "Example Owner",
      "email": "owner@example.com",
      "lastActivityAt": "ISO-8601"
    },
    "steps": [
      {
        "stepKey": "step_1_asset_snapshot",
        "title": "The Asset Snapshot",
        "order": 1,
        "isComplete": true,
        "updatedAt": "ISO-8601",
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
        "revision": 1,
        "uploadedAt": "ISO-8601"
      }
    ],
    "delta": {
      "updatedSince": "2026-02-20T04:12:00.000Z",
      "filtered": true
    }
  }
}
```

Rules:

- `updatedSince` filters returned `steps` and `assets` only.
- `session`, `brokerage`, and `client` always return for context.
- Invalid `updatedSince` format returns `400`.

## 5.2 Run Klor Synthesis

`POST /pipeline/klor-run`

Request:

```json
{
  "sessionId": "UUID"
}
```

Success:

```json
{
  "ok": true,
  "data": {
    "jobId": "UUID"
  }
}
```

Gate:

- Session must be `FINAL_SUBMITTED`.

## 5.3 Run Council

`POST /pipeline/council-run`

Request:

```json
{
  "sessionId": "UUID"
}
```

Success:

```json
{
  "ok": true,
  "data": {
    "jobId": "UUID"
  }
}
```

Gate:

- Session must be `KLOR_SYNTHESIS`.

## 6) Execution Sequence (Required)

Per `sessionId`:

1. `GET /pipeline/session-data/{sessionId}`
2. Confirm `data.session.status === "FINAL_SUBMITTED"`
3. `POST /pipeline/klor-run`
4. `POST /pipeline/council-run`
5. Confirm session reaches `REPORT_READY` (via subsequent fetch/polling)

## 7) Error Contract + Retry Policy

Error shape:

```json
{
  "ok": false,
  "error": "message"
}
```

Retry only on transient:

- `429`, `500`, `502`, `503`, `504`

Backoff:

1. 2s
2. 5s
3. 15s
4. 30s
5. 60s

No retry on:

- `400`, `401`, `403`, `404`, `422`

## 8) Session ID Source

Klor must receive and persist `sessionId` from one of:

1. Upstream orchestration payload
2. BeeSold onboarding/webhook create response
3. Operator handoff (temporary fallback)

`sessionId` is the canonical key for all Klor operations in BeeSold.

## 9) Scope and Access Boundaries

Role boundaries:

1. `ADMIN`: Dashboard/operator actions
2. `EDITOR`: read-focused dashboard
3. `KLOR_SYSTEM`: machine endpoints only (`/pipeline/*`)

Klor must not call operator-only endpoints.

## 10) Security Controls

1. Keep Klor key in secure secret manager only.
2. Never log full key values.
3. Rotate keys immediately if exposed.
4. Use separate keys for dev/staging/prod.

## 11) Related Inbound Webhook (Separate Secret)

BeeSold onboarding webhook endpoint:

- `POST /api/webhooks/client-intake`

Uses separate header:

- `x-beesold-webhook-secret: <WEBHOOK_SHARED_SECRET>`

This is distinct from `x-klor-api-key`.

## 12) Production Test Commands

```bash
BASE_URL="https://app.beesold.hpp-cloud.com"
KLOR_KEY="your-klor-api-key"
SESSION_ID="your-session-id"

curl -s "$BASE_URL/pipeline/session-data/$SESSION_ID" \
  -H "x-klor-api-key: $KLOR_KEY"

curl -s "$BASE_URL/pipeline/session-data/$SESSION_ID?updatedSince=2026-02-20T04:12:00.000Z" \
  -H "x-klor-api-key: $KLOR_KEY"

curl -s -X POST "$BASE_URL/pipeline/klor-run" \
  -H "Content-Type: application/json" \
  -H "x-klor-api-key: $KLOR_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"

curl -s -X POST "$BASE_URL/pipeline/council-run" \
  -H "Content-Type: application/json" \
  -H "x-klor-api-key: $KLOR_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"
```

