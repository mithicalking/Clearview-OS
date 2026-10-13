const { errorResponse, findCustomer, getSiteUrl, getStripe, httpError, jsonResponse, requireUser } = require('./lib/billing.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });
  try {
    const user = await requireUser(event);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, user);
    if (!customer) throw httpError(404, 'No Stripe billing profile was found for this account.');
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${getSiteUrl()}/`,
    });
    return jsonResponse(200, { url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
};
