const Stripe = require('stripe');

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw httpError(503, 'Stripe billing is not configured.');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getSiteUrl() {
  const siteUrl = process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!siteUrl) throw httpError(503, 'Set PUBLIC_SITE_URL in the Netlify environment.');
  return siteUrl.replace(/\/+$/, '');
}

async function requireUser(event) {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) throw httpError(401, 'Sign in to continue.');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw httpError(503, 'Supabase billing authentication is not configured.');
  }

  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status === 401 || response.status === 403) throw httpError(401, 'Your sign-in has expired. Sign in again.');
  if (!response.ok) throw httpError(502, 'Could not verify your sign-in.');
  const user = await response.json();
  if (!user.id) throw httpError(401, 'Could not verify your sign-in.');
  return user;
}

async function findCustomer(stripe, user) {
  const result = await stripe.customers.search({
    query: `metadata['supabase_user_id']:'${user.id}'`,
    limit: 1,
  });
  return result.data[0] || null;
}

async function findActiveSubscription(stripe, user) {
  const customer = await findCustomer(stripe, user);
  if (!customer) return { customer: null, subscription: null };
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 100,
  });
  const subscription = subscriptions.data.find(item =>
    (item.status === 'active' || item.status === 'trialing') && item.metadata.supabase_user_id === user.id
  ) || null;
  return { customer, subscription };
}

function errorResponse(error) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  return jsonResponse(statusCode, { error: statusCode === 500 ? 'Billing request failed.' : error.message });
}

module.exports = { errorResponse, findActiveSubscription, findCustomer, getSiteUrl, getStripe, httpError, jsonResponse, requireUser };
