const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySyncPayWebhookSignature, getSyncPayBaseUrl, normalizeSyncPayStatus, getSyncPayBalance, createSyncPayWithdrawal } = require('../src/lib/syncpay.js');
const { encryptPaymentCredentials } = require('../src/lib/payment-credentials.js');
const { resolvePaymentCredentials } = require('../src/lib/payment-credentials.js');
const { SUPPORTED_PAYMENT_METHODS, normalizeBillingType, normalizeRecurringInterval } = require('../src/lib/payment-options.js');

test('base URL uses official SyncPay host', () => {
  assert.equal(getSyncPayBaseUrl(), 'https://api.syncpayments.com.br/api/partner/v1');
});

test('webhook signature is validated with HMAC SHA256 and raw body', () => {
  const secret = 'tenant-secret';
  const payload = JSON.stringify({ event: 'payment.paid', identifier: 'abc123' });
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(verifySyncPayWebhookSignature(payload, signature, secret), true);
  assert.equal(verifySyncPayWebhookSignature(payload, 'deadbeef', secret), false);
});

test('SyncPay payment status mapping is normalized', () => {
  assert.equal(normalizeSyncPayStatus('paid'), 'paid');
  assert.equal(normalizeSyncPayStatus('approved'), 'paid');
  assert.equal(normalizeSyncPayStatus('pending'), 'pending');
  assert.equal(normalizeSyncPayStatus('failed'), 'failed');
});

test('tenant-scoped SyncPay credentials are preferred over global env fallback', async () => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-syncpay-tenant-isolation';

  const workspaceId = 'ws_001';
  const prisma = {
    workspace: {
      findUnique: async ({ where }) => {
        assert.equal(where.id, workspaceId);
        return { userId: 'user_123' };
      },
    },
    syncPayConnection: {
      findFirst: async ({ where }) => {
        assert.equal(where.workspaceId, workspaceId);
        return {
          clientId: 'client-tenant-123',
          encryptedClientSecret: encryptPaymentCredentials({ clientSecret: 'secret-tenant-456' }),
        };
      },
    },
    paymentIntegration: {
      findUnique: async () => null,
    },
  };

  const secret = process.env.SYNC_PAY_CLIENT_SECRET || 'fallback-secret';
  process.env.SYNC_PAY_CLIENT_SECRET = 'global-secret';
  process.env.SYNC_PAY_CLIENT_ID = 'global-client';

  try {
    const result = await resolvePaymentCredentials(prisma, { workspaceId }, 'syncpay');
    assert.equal(result.clientId, 'client-tenant-123');
    assert.equal(result.clientSecret, 'secret-tenant-456');
  } finally {
    process.env.SYNC_PAY_CLIENT_SECRET = secret;
  }
});

test('SyncPay balance lookup reads the official balance endpoint and normalizes fields', async () => {
  const fetchImpl = async (url, options = {}) => {
    assert.equal(url, 'https://api.syncpayments.com.br/api/partner/v1/balance');
    assert.equal(options.method, undefined);
    return {
      ok: true,
      json: async () => ({ available_balance: 159.50, currency: 'BRL', status: 'available' }),
    };
  };

  const result = await getSyncPayBalance({ accessToken: 'token-123', fetchImpl });
  assert.equal(result.availableBalance, 159.5);
  assert.equal(result.currency, 'BRL');
  assert.equal(result.status, 'available');
});

test('SyncPay withdrawal request retries common payout endpoints and normalizes result', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/withdraw')) {
      return {
        ok: true,
        json: async () => ({ id: 'with_001', status: 'queued', amount: 12.30, currency: 'BRL' }),
      };
    }
    return { ok: false, text: async () => 'not found' };
  };

  const result = await createSyncPayWithdrawal({ accessToken: 'token-456', amount: 12.30, description: 'Taxa da plataforma', fetchImpl });
  assert.equal(result.id, 'with_001');
  assert.equal(result.status, 'queued');
  assert.equal(calls.some((call) => call.url.endsWith('/withdraw')), true);
});

test('SyncPay is supported as a bot payment method and recurring plans allow subscription billing', () => {
  assert.ok(SUPPORTED_PAYMENT_METHODS.includes('syncpay'));
  assert.equal(normalizeBillingType('recurring'), 'recurring');
  assert.equal(normalizeBillingType('one_time'), 'one_time');
  assert.equal(normalizeRecurringInterval('quarterly'), 'quarterly');
  assert.equal(normalizeRecurringInterval('bad-value'), 'monthly');
});
