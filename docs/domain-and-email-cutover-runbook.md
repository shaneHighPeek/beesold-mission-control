# Domain + Email Cutover Runbook (Per Brokerage)

Last updated: 2026-03-10

Use this runbook when onboarding a new broker so web custom-domain and branded email-domain are completed in the same change window.

## 1) Preconditions

1. Brokerage exists in BeeSold and broker can access `/broker/settings`.
2. Supabase migrations for:
   - custom domain fields
   - sender domain fields
3. Vercel project access.
4. DNS access for broker domain.
5. Email provider access (Postmark/SendGrid).

## 2) Web Domain (Phase 4)

1. In Vercel, add broker portal domain to project.
2. Copy the exact CNAME target Vercel gives for this domain.
3. Set BeeSold env so instructions match Vercel target:
   - `BROKER_CUSTOM_DOMAIN_CNAME_TARGET=<vercel-cname-target>`
   - Apply in local `.env.local` and Vercel Production env, then redeploy/restart.
4. In BeeSold `/broker/settings`:
   - set `Custom Domain`
   - click `Save Domain`
   - copy the TXT record details
5. Add DNS records in provider (Cloudflare mapping):
   - CNAME:
     - `Name = <subdomain>` (example `bsold`)
     - `Target = <vercel-cname-target>`
     - `Proxy = DNS only`
   - TXT:
     - `Name = _beesold-verify.<subdomain>` (example `_beesold-verify.bsold`)
     - `Content = beesold-verify-<token>`
     - `Proxy = DNS only`
6. Click `Verify DNS` in BeeSold.
7. Confirm checks:
   - TXT verification = PASS
   - CNAME verification = PASS
   - TLS reachable = PASS
8. Confirm `https://<custom-domain>` loads broker portal.

Important:

- Do not create conflicting records for the same host (no extra A/AAAA for the subdomain).
- If CNAME check fails but TLS passes, Cloudflare is often proxied (switch to DNS only).

## 3) Email Domain (Phase 5)

1. In BeeSold `/broker/settings` ensure `Sender Email` uses broker domain.
2. In email provider, complete sender/domain auth setup.
3. In DNS provider, add required SPF, DKIM, DMARC records.
   - For Postmark also add Return-Path CNAME (`pm-bounces.<domain>` -> `pm.mtasv.net` by default).
4. In BeeSold `/broker/settings`, open **Branded Email Domain** section and click `Verify Sender DNS`.
5. Confirm status = `VERIFIED`.

Notes:

- For Postmark subdomain mode, SPF can be optional. DMARC + Return-Path + DKIM are the critical checks.
- If Postmark DKIM selector is dynamic, set `EMAIL_DOMAIN_DKIM_SELECTORS` so strict DKIM check matches your provider record.

## 4) Production Send Validation

1. From broker pipeline, create a test client or resend invite.
2. Confirm in Mission Control/Supabase `outbound_emails`:
   - `provider_status = 'SENT'`
   - `from_email` uses branded sender
3. Confirm audit event `WELCOME_EMAIL_SENT` exists with provider metadata.

## 5) Exit Criteria

1. Custom web domain verified and serving TLS.
2. Sender domain verified.
3. At least one invite sent successfully from branded sender.
4. Brokerage is ready for client-facing go-live.
