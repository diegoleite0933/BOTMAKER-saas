const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMarketplaceAuthorizationUrl,
  exchangeMarketplaceAuthorizationCode,
  hashOAuthState,
} = require("../src/lib/mercadopago-marketplace.js");
const { decryptPaymentCredentials, encryptPaymentCredentials } = require("../src/lib/payment-credentials.js");

process.env.NEXTAUTH_SECRET ||= "marketplace-oauth-test-secret";
process.env.APP_URL = "https://odisseia.example";

function createPlatformAccount() {
  return {
    platformReceivingAccount: {
      findUnique: async () => ({
        status: "CREDENTIALS_SAVED",
        encryptedCredentials: encryptPaymentCredentials({ clientId: "platform-app-id", clientSecret: "platform-app-secret" }),
      }),
    },
  };
}

test("authorization URL stores only a hash of a short-lived tenant-bound state", async () => {
  let createdState;
  const prisma = {
    ...createPlatformAccount(),
    oAuthState: { create: async ({ data }) => { createdState = data; } },
  };
  const url = new URL(await createMarketplaceAuthorizationUrl(prisma, {
    userId: "user-1",
    workspaceId: "workspace-1",
    now: new Date("2026-01-01T00:00:00Z"),
  }));
  const plainState = url.searchParams.get("state");

  assert.equal(url.origin, "https://auth.mercadopago.com.br");
  assert.equal(url.searchParams.get("client_id"), "platform-app-id");
  assert.equal(url.searchParams.get("redirect_uri"), "https://odisseia.example/api/integrations/mercadopago/callback");
  assert.equal(createdState.stateHash, hashOAuthState(plainState));
  assert.notEqual(createdState.stateHash, plainState);
  assert.equal(createdState.userId, "user-1");
  assert.equal(createdState.workspaceId, "workspace-1");
  assert.equal(createdState.expiresAt.toISOString(), "2026-01-01T00:10:00.000Z");
});

test("authorization code exchange consumes state and stores encrypted seller OAuth credentials", async () => {
  const state = "random-opaque-state";
  const oauthState = {
    id: "oauth-state-1",
    stateHash: hashOAuthState(state),
    provider: "mercadopago_marketplace",
    userId: "user-1",
    workspaceId: "workspace-1",
    expiresAt: new Date("2026-01-01T00:10:00Z"),
    consumedAt: null,
  };
  let consumed = false;
  let integrationData;
  const prisma = {
    ...createPlatformAccount(),
    oAuthState: { findUnique: async () => oauthState },
    $transaction: async (callback) => callback({
      oAuthState: { updateMany: async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; } },
      paymentIntegration: { upsert: async ({ create }) => { integrationData = create; } },
    }),
  };
  const result = await exchangeMarketplaceAuthorizationCode(prisma, {
    code: "one-time-auth-code",
    state,
    now: new Date("2026-01-01T00:05:00Z"),
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.mercadopago.com/oauth/token");
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("code"), "one-time-auth-code");
      assert.equal(body.get("state"), state);
      return {
        ok: true,
        json: async () => ({ access_token: "seller-token", refresh_token: "seller-refresh", user_id: 12345, expires_in: 3600 }),
      };
    },
  });

  assert.deepEqual(result, { userId: "user-1", workspaceId: "workspace-1", collectorId: "12345" });
  const credentials = decryptPaymentCredentials(integrationData.encryptedCredentials);
  assert.equal(credentials.accessToken, "seller-token");
  assert.equal(credentials.refreshToken, "seller-refresh");
  assert.equal(credentials.marketplaceOAuth, true);
  assert.equal(consumed, true);
});

test("expired and consumed OAuth states are rejected before contacting Mercado Pago", async () => {
  const state = "state-expired";
  const prisma = {
    ...createPlatformAccount(),
    oAuthState: { findUnique: async () => ({
      id: "oauth-state-expired",
      stateHash: hashOAuthState(state),
      provider: "mercadopago_marketplace",
      userId: "user-1",
      workspaceId: "workspace-1",
      expiresAt: new Date("2025-12-31T23:59:59Z"),
      consumedAt: null,
    }) },
  };
  await assert.rejects(exchangeMarketplaceAuthorizationCode(prisma, {
    code: "code",
    state,
    now: new Date("2026-01-01T00:00:00Z"),
    fetchImpl: async () => { throw new Error("provider must not be called"); },
  }), /inválido, expirado ou já utilizado/);
});