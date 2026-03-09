# Domain + Email Cutover Runbook (Per Brokerage)

Last updated: 2026-03-09

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
2. In BeeSold `/broker/settings`:
   - set `Custom Domain`
   - click `Save Domain`
   - copy TXT + CNAME records shown
3. Add those records in DNS provider.
4. Click `Verify DNS` in BeeSold.
5. Confirm status = `VERIFIED`.
6. Confirm `https://<custom-domain>` loads broker portal over TLS.

## 3) Email Domain (Phase 5)

1. In BeeSold `/broker/settings` ensure `Sender Email` uses broker domain.
2. In email provider, complete sender/domain auth setup.
3. In DNS provider, add required SPF, DKIM, DMARC records.
4. In BeeSold `/broker/settings`, open **Branded Email Domain** section and click `Verify Sender DNS`.
5. Confirm status = `VERIFIED`.

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
