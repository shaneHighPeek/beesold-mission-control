# DEMO-07.2 Seed Data Plan

Purpose: keep a stable demo dataset ready across sessions.

## Broker tenant

- Brokerage slug: `off-market-group`
- Broker account: configured via `BROKER_PORTAL_USERS`

## Suggested demo clients

1. `Harbor Trade Centre` - `INVITED` - template `COMMERCIAL_V1`
2. `Northpoint Logistics Hub` - `IN_PROGRESS` - template `COMMERCIAL_V1`
3. `Riverside Medical Suites` - `PARTIAL_SUBMITTED` - template `COMMERCIAL_V1`
4. `Summit Office Park` - `FINAL_SUBMITTED` - template `COMMERCIAL_V1`

## Create via API (operator session required)

Use `POST /api/onboarding/clients` payload with:

```json
{
  "brokerageSlug": "off-market-group",
  "businessName": "Harbor Trade Centre",
  "contactName": "Alex Owner",
  "email": "alex+harbor@example.com",
  "triggerInvite": true,
  "intakeTemplate": "COMMERCIAL_V1"
}
```

## SQL verification

```sql
select
  s.id,
  c.business_name,
  s.status,
  s.intake_template,
  s.created_at
from intake_sessions s
join client_identities c on c.id = s.client_id
where s.brokerage_id = (select id from brokerages where slug = 'off-market-group')
order by s.created_at desc;
```
