import assert from 'node:assert/strict';
import test from 'node:test';
import { selectedRevisions } from './common.mjs';

test('a reversed range fails instead of expanding a command to the entire bank', async () => {
  await assert.rejects(selectedRevisions(['020-001']), /must be ascending/);
  await assert.rejects(selectedRevisions(['001', '020-001']), /must be ascending/);
});

test('explicit ranges retain their requested scope and reject missing IDs', async () => {
  const selected = await selectedRevisions(['019-020', '019']);
  assert.deepEqual(selected.map(revision => revision.question_id), ['019', '020']);
  await assert.rejects(selectedRevisions(['999']), /revision files are missing/);
});
