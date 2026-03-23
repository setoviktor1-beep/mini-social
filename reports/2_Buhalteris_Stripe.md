# Buhalteris Stripe / Finance Audit

Scope audited:

- `app/api/stripe/`
- `app/api/finance/`
- `app/pricing/`

## Findings

### 1. Critical: `/api/stripe/subscribe` can create multiple concurrent subscriptions for one user, while the webhook only tracks one

- File: `app/api/stripe/subscribe/route.ts:33-73`
- Related state overwrite: `app/api/stripe/webhook/route.ts:73-82`

Why this is a bug:

- The endpoint never checks whether the user already has an active or trialing subscription before creating a new Checkout Session.
- A user can hit `POST /api/stripe/subscribe` repeatedly and Stripe will create multiple subscriptions for the same customer.
- The webhook stores subscription state with `onConflict: 'user_id'`, so only the last processed `stripe_subscription_id` survives in the local `subscriptions` row.

Impact:

- Users can be double-billed or triple-billed.
- Canceling through the portal may only cancel one of several live Stripe subscriptions.
- The app loses visibility of older still-billable subscriptions because the local row is overwritten.

Recommended fix:

- Before creating a new subscription Checkout Session, query Stripe for an existing non-canceled subscription for the customer and block duplicate creation.
- Treat plan changes as subscription updates, not “create another subscription”.
- Store subscription rows keyed by `stripe_subscription_id`, or enforce a strong invariant that only one live subscription may exist and verify it before session creation.

### 2. High: wallet top-ups are not idempotent and can be credited multiple times on webhook retries

- File: `app/api/stripe/webhook/route.ts:28-45`

Why this is a bug:

- Stripe webhook delivery is at-least-once. This handler never records `event.id`, `session.id`, or any fulfilled-payment marker.
- Every repeated `checkout.session.completed` delivery for the same payment calls `credit_wallet_balance` again.

Impact:

- A single successful top-up can credit the wallet multiple times after retries, manual replays, or operational re-delivery.
- This is direct financial loss.

Recommended fix:

- Persist processed webhook `event.id`s or processed Checkout Session IDs and make fulfillment idempotent.
- Reject duplicate fulfillment before calling `credit_wallet_balance`.

### 3. High: wallet top-ups are fulfilled on `checkout.session.completed` without verifying the payment is actually settled

- Files:
- `app/api/stripe/create-checkout/route.ts:39-48`
- `app/api/stripe/webhook/route.ts:28-45`

Why this is a bug:

- The webhook credits the wallet as soon as the Checkout Session completes, but it never checks `session.payment_status === 'paid'`.
- Stripe documents that delayed-notification payment methods can emit `checkout.session.completed` before funds settle; later success/failure is communicated via `checkout.session.async_payment_succeeded` or `checkout.session.async_payment_failed`.

Impact:

- Users can receive wallet balance before funds are available.
- Failed delayed payments can still leave permanent wallet credits if there is no compensating reversal logic.

Recommended fix:

- Only credit immediately when `session.payment_status === 'paid'`.
- For delayed methods, mark the payment pending on `checkout.session.completed` and credit only on `checkout.session.async_payment_succeeded`.

Stripe references:

- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/payments/advanced/dashboard-payment-methods

### 4. High: subscription webhooks overwrite privileged roles and can demote admins or masters to plain users

- File: `app/api/stripe/webhook/route.ts:84-108`

Why this is a bug:

- On every subscription create/update, the handler writes `role = 'pro'` or `role = 'user'`.
- On subscription deletion, it unconditionally writes `role = 'user'`.
- There is no preservation of existing elevated roles such as `admin` or `master`.

Impact:

- An admin who subscribes and later cancels can lose admin privileges.
- Any non-subscription role model stored in `profiles.role` is corrupted by billing events.

Recommended fix:

- Do not let billing webhooks overwrite unrelated authorization roles.
- Preserve elevated roles explicitly, or separate “billing entitlement” from “application role” into distinct fields.

### 5. Medium: free-trial expiration behavior is not configured explicitly, but the UI promises a specific no-card trial flow

- Files:
- `app/api/stripe/subscribe/route.ts:57-72`
- `app/pricing/page.tsx:150-152`
- `app/pricing/page.tsx:187-189`
- `app/api/stripe/webhook/route.ts:92-109`

Why this is a bug:

- The code enables free trials without collecting a payment method via `payment_method_collection: 'if_required'`.
- It does not set `subscription_data.trial_settings.end_behavior.missing_payment_method`.
- The pricing page promises “14 dienų nemokamas bandymas” and says the card is requested only after the trial, but the actual trial-end behavior is left to Stripe configuration/default behavior rather than code.
- The downgrade logic assumes an eventual `customer.subscription.deleted` path, but the route does not enforce cancellation-at-trial-end behavior.

Impact:

- Trial expiration behavior can differ between environments or dashboard settings.
- Users may end up `past_due` or otherwise in a flow that does not match the product promise.
- Billing/access transitions at trial end are not deterministic from the codebase.

Recommended fix:

- Set `subscription_data.trial_settings.end_behavior.missing_payment_method` explicitly.
- If the business rule is “trial ends and access is revoked unless the user later adds a card”, configure `cancel` and test the resulting webhook path end to end.
- If the business rule is “pause until a card is added”, configure `pause` and explicitly handle the paused state in product messaging.

Stripe references:

- https://docs.stripe.com/billing/subscriptions/trials
- https://docs.stripe.com/payments/checkout/free-trials

### 6. Low: finance settings silently replace valid zero values with defaults

- File: `app/api/finance/settings/route.ts:40-48`

Why this is a bug:

- `Number(value) || default` treats `0` as falsy.
- Legitimate values like `0` for `gpm_percent` or `pvm_percent` are silently rewritten to `15` or `21`.

Impact:

- User-entered tax configuration can be corrupted.
- Financial calculations can become wrong without any validation error.

Recommended fix:

- Parse with `Number.isFinite(...)` and preserve zero.
- Reject invalid numbers instead of silently replacing them.

### 7. Low: monthly income accepts invalid numeric payloads without validation

- File: `app/api/finance/income/route.ts:31-48`

Why this is a bug:

- `amount: Number(amount)` is written without checking `Number.isFinite`.
- Inputs such as `null`, empty strings, `"abc"`, or very large values can become `0`, `NaN`, or database errors depending on coercion and driver behavior.

Impact:

- Finance data quality is fragile.
- Bad input can either corrupt stored income or surface as avoidable 500s.

Recommended fix:

- Validate `month` format and require a finite numeric `amount`.
- Return `400` for invalid payloads instead of relying on database failure.

## Overall assessment

The highest-risk defects are in Stripe lifecycle handling:

- duplicate subscription creation,
- non-idempotent wallet fulfillment,
- crediting before funds are settled,
- and role corruption during cancellation/update events.

Those should be treated as release blockers for billing.
