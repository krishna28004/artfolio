# Commission email-code verification

Visitors to `/commission` enter an email address, receive a six-digit code, and enter it on the page. A correct code grants one hour of commission access in that browser. The code expires after 10 minutes and can be tried once. This flow does not create a customer account or Supabase Auth session. Studio Portal login and MFA remain separate.

## Required service configuration

1. Configure `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` in the deployment environment. The commission code is sent by the application's Resend integration, not by a Supabase Auth template. Test delivery to a separate address, including the spam folder.
2. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Redis stores each one-time challenge for 10 minutes and enforces distributed request limits. Production fails closed when these values are absent or Redis is unavailable.
3. Keep the existing server-only `SUPABASE_SERVICE_ROLE_KEY` configured. It derives a separate signing key for the one-hour, HttpOnly verification cookie and the challenge digest. Never expose it to client code.
4. No customer OAuth provider, Supabase Auth signup, callback URL, password, or Supabase email template is needed. The production **Magic link or OTP** template was separately updated on 19 October 2026 to include `{{ .Token }}` and retain `{{ .ConfirmationURL }}` for existing Auth uses; it is unrelated to this accountless commission flow.

## Open request intake

The email-code screen remains visible while intake is closed. To allow submissions, deploy the code, set `ARTFOLIO_COMMISSIONS_ENABLED=true` in the deployment environment, redeploy, and select **Open new requests** in Studio **Settings → Commission requests**. Both controls must be open. The private `commission-private` Storage bucket must also be operational. Payments may remain disabled; creating a request takes no payment.

Test with a customer email: receive a code, reject an incorrect or expired code, request a fresh code, accept it, fill out the form, upload an optional private reference, submit, follow the tracking link, and confirm the request appears in the Studio queue. Repeat after **Use another email** and after one hour to confirm the form is gated again. Do not use curator credentials for this customer test.
