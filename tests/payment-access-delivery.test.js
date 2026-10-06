const test = require('node:test');
const assert = require('node:assert/strict');

const { deliverPaidOrder } = require('../src/lib/product-delivery.js');

function createMockBot() {
  return {
    telegram: {
      createChatInviteLink: async () => ({ invite_link: 'https://t.me/invite/abc123' }),
      revokeChatInviteLink: async () => undefined,
      sendMessage: async () => ({ ok: true }),
    },
  };
}

test('deliverPaidOrder grants access for a paid order without fee side effects', async () => {
  const created = [];
  const prisma = {
    $transaction: async (callback) => {
      const tx = {
        order: {
          updateMany: async ({ where, data }) => {
            assert.equal(where.id, 'order_123');
            assert.equal(data.status, 'paid');
            return { count: 1 };
          },
        },
        access: {
          create: async ({ data }) => {
            created.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  };

  const bot = createMockBot();
  const order = {
    id: 'order_123',
    botId: 'bot_1',
    telegramUserId: '123456',
    status: 'pending',
    bot: { workspaceId: 'workspace_1', paymentMethod: 'mercadopago' },
    product: {
      name: 'Produto VIP',
      deliveries: [{ id: 'delivery_1', type: 'group', telegramChatId: '-100123', content: null, durationDays: null }],
    },
    bumpProduct: null,
  };

  const result = await deliverPaidOrder({ prisma, bot, order });

  assert.equal(result, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].telegramUserId, '123456');
  assert.equal(created[0].deliveryId, 'delivery_1');
  assert.equal(created[0].status, 'active');
});

test('deliverPaidOrder ignores duplicate paid processing to avoid duplicate access', async () => {
  const created = [];
  const prisma = {
    $transaction: async (callback) => {
      const tx = {
        order: {
          updateMany: async () => ({ count: 0 }),
        },
        access: {
          create: async ({ data }) => {
            created.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  };

  const bot = createMockBot();
  const order = {
    id: 'order_456',
    botId: 'bot_2',
    telegramUserId: '654321',
    status: 'paid',
    bot: { workspaceId: 'workspace_2', paymentMethod: 'mercadopago' },
    product: {
      name: 'Produto VIP',
      deliveries: [{ id: 'delivery_2', type: 'group', telegramChatId: '-100456', content: null, durationDays: null }],
    },
    bumpProduct: null,
  };

  const result = await deliverPaidOrder({ prisma, bot, order });

  assert.equal(result, false);
  assert.equal(created.length, 0);
});
