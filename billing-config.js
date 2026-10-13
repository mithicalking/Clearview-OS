const { errorResponse, getStripe, httpError, jsonResponse } = require('./lib/billing.cjs');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed.' });
  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) throw httpError(503, 'Stripe billing is not configured with a subscription price.');
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    if (!price.active || !price.recurring || price.unit_amount == null) {
      throw httpError(503, 'The configured Stripe price must be active, recurring, and have a fixed amount.');
    }
    const product = typeof price.product === 'object' ? price.product : await stripe.products.retrieve(price.product);
    return jsonResponse(200, {
      name: product.name,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
