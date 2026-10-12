# SPATDEL Paystack KYC setup

This integration starts Nigerian customer identity validation using Paystack's bank-account identification flow with BVN. It does not collect NIN because the configured Paystack customer-identification endpoint documents the Nigerian flow as bank account + BVN.

## Server environment variables

Set these in your local `.env.local` and in your hosting provider's server environment. Do not add real secret values to GitHub or any `NEXT_PUBLIC_` variable.

- `PAYSTACK_SECRET_KEY` — Paystack secret key (use a test key for development).
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key; server-side only.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Restart the Next.js server after changing local environment variables.

## Paystack webhook

In the Paystack dashboard, configure the webhook URL as:

`https://YOUR-PUBLISHED-DOMAIN/api/kyc/paystack/webhook`

Subscribe to these identity events if they are available for your Paystack integration:

- `customeridentification.success`
- `customeridentification.failed`

The webhook checks Paystack's `x-paystack-signature` before changing KYC status. A user is marked verified only after the signed success event is received.

## Important

- The wallet page submits BVN and the account number to the SPATDEL server, which sends them to Paystack for verification. SPATDEL does not persist either raw value.
- The database stores the Paystack customer code, provider name, status, timestamps and a short failure note.
- Keep wallet deposits, withdrawals, escrow, and payouts disabled until the relevant Paystack services, business/compliance approvals, and server-side payment reconciliation are configured.
- Test using Paystack's documented test credentials before considering live verification.
