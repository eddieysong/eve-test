import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changeFact } from '../agent/lib/conversation-memory.ts';
import { readDocument, writeDocument } from '../agent/lib/local-store.ts';
import { conversationTools } from '../agent/lib/conversation-tools.ts';

const directory = await mkdtemp(join(tmpdir(), 'companion-facts-test-'));
process.env.COMPANION_DATA_DIR = directory;
after(() => rm(directory, {recursive: true, force: true}));

test('remember preserves authored content and deduplicates retries', async () => {
  await writeDocument('memory.md', '# Memory\n\n## Important context\nHand-edited paragraph.\n', null);
  assert.equal((await changeFact('  Likes concise   answers. ', 'remember')).changed, true);
  assert.equal((await changeFact('Likes concise answers.', 'remember')).changed, false);
  const memory = await readDocument('memory.md');
  assert.match(memory.content, /Hand-edited paragraph\./);
  assert.equal(memory.content.match(/Likes concise answers\./g).length, 1);
});
test('forget removes only the exact saved fact', async () => {
  assert.equal((await changeFact('Likes concise', 'forget')).changed, false);
  assert.equal((await changeFact('Likes concise answers.', 'forget')).changed, true);
  const memory = await readDocument('memory.md');
  assert.match(memory.content, /Hand-edited paragraph\./);
  assert.doesNotMatch(memory.content, /Likes concise answers/);
});
test('concurrent remembers preserve both facts', async () => {
  await Promise.all([changeFact('First separate fact.', 'remember'), changeFact('Second separate fact.', 'remember')]);
  const memory = await readDocument('memory.md');
  assert.match(memory.content, /First separate fact/);
  assert.match(memory.content, /Second separate fact/);
});
test('memory tools reject calls outside the local authenticated companion', () => {
  const tools = conversationTools();
  assert.throws(() => tools.remember.execute({fact:'Must not save'}, {session:{auth:{current:null}}}), /require the authenticated local companion/);
});
test('current time is fresh and uses the requested time zone', () => {
  const before = Date.now();
  const result = conversationTools().get_current_time.execute({timeZone:'UTC'});
  assert.equal(result.timeZone, 'UTC');
  assert.ok(Date.parse(result.iso) >= before && Date.parse(result.iso) <= Date.now());
});
