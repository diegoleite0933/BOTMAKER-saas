const test = require('node:test');
const assert = require('node:assert/strict');

const { runningBots, startingBots, startBot } = require('../bot-runner.js');

test('bot runner does not launch the same bot twice while it is already starting', async () => {
  runningBots.clear();
  startingBots.clear();

  const botRecord = { id: 'bot-duplicate-check', username: 'dup_check_bot', token: 'fake-token' };
  startingBots.add(botRecord.id);

  await startBot(botRecord);

  assert.equal(startingBots.has(botRecord.id), true);
  assert.equal(runningBots.has(botRecord.id), false);
});
