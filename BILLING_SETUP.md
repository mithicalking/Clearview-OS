# Stripe and Netlify Billing Setup

The app uses Stripe subscriptions and Netlify Functions. A subscription is checked directly against Stripe after Supabase sign-in and before app data is loaded. No Stripe secret or subscription status is stored in the browser.

## 1. Create a Stripe subscription price

1. In Stripe, create a product and an active recurring price. Use test mode while configuring.
2. Copy the recurring Price ID (`price_...`).
3. Enable the Stripe Billing customer portal and allow customers to view and cancel subscriptions.

## 2. Configure Netlify

Set the Netlify site base directory to `kingsdetails-app` (or deploy this directory as the site root). The included `netlify.toml` publishes this directory and deploys functions from `netlify/functions`.

Add these site environment variables in Netlify:

- `STRIPE_SECRET_KEY`: Stripe secret key (`sk_test_...` for testing, `sk_live_...` for production).
- `STRIPE_PRICE_ID`: the active recurring Stripe Price ID.
- `SUPABASE_URL`: the same project URL used by the app.
- `SUPABASE_ANON_KEY`: the Supabase anon/public key used by the app. Do not use the service-role key.
- `PUBLIC_SITE_URL`: canonical deployed origin, for example `https://clearview.netlify.app`.

Redeploy after changing environment variables. For local development, copy `.env.example` to `.env` and use `netlify dev` from this directory. Keep real `.env` files out of source control.

## 3. Verify the flow

1. Sign in with a Supabase account that has no active Stripe subscription. The app remains locked and shows the subscription price.
2. Select **Subscribe securely**. Stripe Checkout creates a subscription associated with the Supabase user ID.
3. After successful checkout, the app re-checks the subscription with Stripe before loading data.
4. Use **Settings > Account & Data > Manage subscription** to open the Stripe customer portal.

The Netlify functions are `billing-config`, `subscription-status`, `create-checkout-session`, and `create-portal-session`. The three authenticated functions validate the Supabase access token through Supabase Auth before acting. Access fails closed if the billing status cannot be verified.

For an end-to-end test, use Stripe test keys and a test card such as `4242 4242 4242 4242` with any future expiration and CVC. Switch to live keys only after confirming the Netlify production domain and Stripe portal configuration.
