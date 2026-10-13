const { errorResponse, findActiveSubscription, getSiteUrl, getStripe, httpError, jsonResponse, requireUser } = require('./lib/billing.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });
  try {
    const user = await requireUser(event);
    const stripe = getStripe();
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) throw httpError(503, 'Stripe billing is not configured with a subscription price.');

    const { customer, subscription } = await findActiveSubscription(stripe, user);
    if (subscription) return jsonResponse(409, { error: 'This account already has an active subscription.' });

    let stripeCustomer = customer;
    if (!stripeCustomer) {
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
    }

    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomer.id,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
    });
    return jsonResponse(200, { url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
};
