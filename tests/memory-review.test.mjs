import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureReviewInput, readReviewSnapshot, saveReviewReport } from '../agent/lib/memory-review.ts';
import { readDocument, writeDocument } from '../agent/lib/local-store.ts';
import { readNote, saveNote, searchNotes } from '../agent/lib/notes-store.ts';
import reviewMemory from '../agent/tools/review_memory.ts';

const directory = await mkdtemp(join(tmpdir(), 'companion-review-'));
process.env.COMPANION_DATA_DIR = directory;
after(() => rm(directory, { recursive: true, force: true }));

test('review tool rejects callers outside the local owner and scheduler', async () => {
  await assert.rejects(async () => reviewMemory.execute({action:'inspect'}, {session:{auth:{current:{authenticator:'external',principalId:'other',principalType:'user'}}}}), /only to the local owner/);
});

test('captures only user text and deduplicates concurrent capture retries', async () => {
  const messages = [{role:'user',content:[{type:'text',text:'I prefer morning walks.'},{type:'image',image:'ignored'}]}, {role:'assistant',content:'Invented fact'}];
  await Promise.all([captureReviewInput('turn-1','session-1',messages), captureReviewInput('turn-1','session-1',messages)]);
  const snapshot = await readReviewSnapshot();
  const captured = snapshot.sources.filter(source => source.id.startsWith('message:'));
  assert.equal(captured.length,1);
  assert.equal(captured[0].text,'I prefer morning walks.');
});
test('does not copy obvious credentials into the review inbox', async () => {
  await captureReviewInput('secret','session-1',[{role:'user',content:'API key: test-private-value'}]);
  assert.doesNotMatch(await readFile(join(directory,'review/inbox.json'),'utf8'), /test-private-value/);
});
test('saves source-linked proposals as a note without changing core memory', async () => {
  await writeDocument('memory.md','# Memory\n\n- Likes tea\n',null);
  const snapshot = await readReviewSnapshot();
  const sourceId = snapshot.sources.find(source => source.id.startsWith('message:')).id;
  const report = {summary:'One preference worth reviewing.',suggestions:[{kind:'remember',text:'Prefers morning walks.',sourceIds:[sourceId]}]};
  const result = await saveReviewReport(snapshot.version,report,'review-session');
  assert.equal(result.saved,true);
  assert.match((await readNote(result.id)).body,/Prefers morning walks/);
  assert.equal((await readDocument('memory.md')).content,'# Memory\n\n- Likes tea\n');
  const next = await readReviewSnapshot();
  assert.equal(next.version,snapshot.version);
  assert.equal(next.previousReview.id,result.id);
  const repeated = await saveReviewReport(snapshot.version,report,'other-session');
  assert.equal(repeated.saved,false);
  assert.equal((await searchNotes('memory-review')).length,1);
});
test('rejects stale snapshots and invented evidence IDs', async () => {
  await saveNote({title:'New detail',body:'Likes walking by the river.'},'detail');
  const snapshot = await readReviewSnapshot();
  await assert.rejects(saveReviewReport(snapshot.version,{summary:'Guess',suggestions:[{kind:'remember',text:'Invented',sourceIds:['not-a-source']}]},'session'),/cite a source/);
  await captureReviewInput('turn-2','session-1',[{role:'user',content:'Actually I prefer afternoon walks.'}]);
  await assert.rejects(saveReviewReport(snapshot.version,{summary:'Old',suggestions:[]},'session'),/sources changed/);
});
test('bounds capture size and keeps the most recent 24 inputs', async () => {
  for(let n=0;n<30;n++) await captureReviewInput(`bounded-${n}`,'session-2',[{role:'user',content:`${n}: ${'x'.repeat(2000)}`}]);
  const entries = JSON.parse(await readFile(join(directory,'review/inbox.json'),'utf8'));
  assert.equal(entries.length,24);
  assert.ok(entries.every(entry=>entry.text.length<=1200));
  assert.ok(entries.at(-1).text.startsWith('29:'));
});
