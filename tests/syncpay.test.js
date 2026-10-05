const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySyncPayWebhookSignature, getSyncPayBaseUrl, normalizeSyncPayStatus } = require('../src/lib/syncpay.js');
const { encryptPaymentCredentials } = require('../src/lib/payment-credentials.js');
const { resolvePaymentCredentials } = require('../src/lib/payment-credentials.js');

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
