# DEMO-07.4 Known Limitations

Last updated: 2026-03-09

1. Domain and sender verification are DNS-dependent.
- External DNS propagation can delay verification status changes.

2. Existing sessions keep their original template.
- Changing template is supported at create time; existing sessions are not auto-migrated.

3. Commercial validation currently enforces core final-submit blockers only.
- Required blockers: title search upload, tenant lease docs (if tenanted), minimum photo count.

4. Live custom domains require both DNS + Vercel domain attachment.
- DNS records alone are not enough for routing/TLS.

5. Branded sender domains require provider-side domain verification (Postmark/other).
- Fallback sender behavior depends on `REQUIRE_VERIFIED_SENDER_DOMAIN`.
