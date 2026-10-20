// Pure helpers from the website that decide what people see (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRuns } from '../../client/src/lib/api.js';

const ev = (id, action, detail, user = 'u1') => ({ _id: id, action, detail, user: user && { _id: user } });

test('groupRuns: a batch request logged once per student shows as one row with a count', () => {
  const rows = groupRuns([
    ev(1, 'access.request', 'asked batch 23MX for: PAN'), ev(2, 'access.request', 'asked batch 23MX for: PAN'),
    ev(3, 'access.request', 'asked batch 23MX for: PAN'), ev(4, 'login', 'Chrome on Windows'),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].count, 3);
  assert.deepEqual(rows[0].items.map((e) => e._id), [1, 2, 3]);
  assert.equal(rows[1].count, 1);
});

test('groupRuns: only consecutive, identical events by the same person are merged', () => {
  const rows = groupRuns([
    ev(1, 'login', 'Chrome'), ev(2, 'document.view', 'PAN'), ev(3, 'login', 'Chrome'),
    ev(4, 'record.view', 'PAN', 'u1'), ev(5, 'record.view', 'PAN', 'u2'),
  ]);
  assert.deepEqual(rows.map((r) => r.count), [1, 1, 1, 1, 1]);
});

test('groupRuns: empty and missing input give no rows', () => {
  assert.deepEqual(groupRuns([]), []);
  assert.deepEqual(groupRuns(), []);
});
