const { errorResponse, findActiveSubscription, getStripe, jsonResponse, requireUser } = require('./lib/billing.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed.' });
  try {
    const user = await requireUser(event);
    const stripe = getStripe();
    const checkoutSessionId = event.queryStringParameters?.session_id;
    if (checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ['subscription'] });
      if (session.client_reference_id !== user.id) throw Object.assign(new Error('That checkout session does not belong to this account.'), { statusCode: 403 });
      const checkoutSubscription = session.subscription;
      const subscription = typeof checkoutSubscription === 'object' ? checkoutSubscription : null;
      if (session.status === 'complete' && subscription?.metadata?.supabase_user_id === user.id) {
        const active = subscription.status === 'active' || subscription.status === 'trialing';
        return jsonResponse(200, {
          active,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end || null,
        });
      }
    }
    const { subscription } = await findActiveSubscription(stripe, user);
    return jsonResponse(200, {
      active: !!subscription,
      status: subscription?.status || 'inactive',
      currentPeriodEnd: subscription?.current_period_end || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
