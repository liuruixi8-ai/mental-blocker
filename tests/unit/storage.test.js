'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../../js/storage.js');
const LEVELS = require('../../js/levels.js');

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

const load = storage => Store.load(storage, LEVELS);

test('missing key means no progress', () => {
  assert.deepEqual([...load(fakeStorage())], []);
});

test('corrupt, legacy or wrongly shaped data means no verified progress', () => {
  for (const bad of ['{oops', '"text"', '[1,2]', '{"completed":[1,2]}', '{"bestMoves":[1,2]}', '{"bestMoves":"all"}', 'null']) {
    assert.deepEqual([...load(fakeStorage({ [Store.KEY]: bad }))], [], bad);
  }
});

test('legacy progress is ignored without deleting it', () => {
  const old = '{"completed":[1,2,3,4]}';
  const storage = fakeStorage({ 'safezone.v1': old });
  assert.deepEqual([...load(storage)], []);
  Store.save(storage, new Map([[1, 1]]));
  assert.equal(storage.data['safezone.v1'], old);
});

test('only valid passing scores for real levels are loaded', () => {
  const scores = { 1: 1, 2: 3, 3: 4, 4: '4', 5: 0, 6: -1, 7: 1.5, 22: 1, '-1': 1, '3.5': 1 };
  const storage = fakeStorage({ [Store.KEY]: JSON.stringify({ bestMoves: scores }) });
  assert.deepEqual([...load(storage)], [[1, 1], [3, 4]]);
});

test('a throwing or missing storage means no progress, and saving does not throw', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual([...load(throwing)], []);
  assert.doesNotThrow(() => Store.save(throwing, new Map([[1, 1]])));
  assert.deepEqual([...load(null)], []);
  assert.doesNotThrow(() => Store.save(null, new Map([[1, 1]])));
});

test('passing scores survive save and load', () => {
  const storage = fakeStorage();
  Store.save(storage, new Map([[3, 4], [1, 1], [2, 2]]));
  assert.equal(storage.data[Store.KEY], '{"bestMoves":{"1":1,"2":2,"3":4}}');
  assert.deepEqual([...load(storage)], [[1, 1], [2, 2], [3, 4]]);
});

test('a level requires passing scores for every previous level', () => {
  const done = new Map([[1, 1], [2, 2], [5, 5]]);
  assert.equal(Store.isUnlocked(1, new Map(), LEVELS), true);
  assert.equal(Store.isUnlocked(2, new Map(), LEVELS), false);
  assert.equal(Store.isUnlocked(3, done, LEVELS), true);
  assert.equal(Store.isUnlocked(4, done, LEVELS), false);
  assert.equal(Store.isUnlocked(6, done, LEVELS), false);
  assert.equal(Store.isUnlocked(2, new Map([[1, 2]]), LEVELS), false, 'over-limit score');
  for (const invalid of [0, -1, 1.5, '1', 22, Infinity]) {
    assert.equal(Store.isUnlocked(invalid, done, LEVELS), false);
  }
});

test('sound is on unless it was saved as off', () => {
  assert.equal(Store.loadSoundOn(fakeStorage()), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'on' })), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'junk' })), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'off' })), false);
});

test('the sound choice round-trips, and a throwing or missing storage means sound on', () => {
  const s = fakeStorage();
  Store.saveSoundOn(s, false);
  assert.equal(s.data[Store.SOUND_KEY], 'off');
  assert.equal(Store.loadSoundOn(s), false);
  Store.saveSoundOn(s, true);
  assert.equal(s.data[Store.SOUND_KEY], 'on');
  assert.equal(Store.loadSoundOn(s), true);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(Store.loadSoundOn(throwing), true);
  assert.doesNotThrow(() => Store.saveSoundOn(throwing, false));
  assert.equal(Store.loadSoundOn(null), true);
  assert.doesNotThrow(() => Store.saveSoundOn(null, false));
});
