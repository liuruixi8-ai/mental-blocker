/*
 * Level progress, saved in localStorage as {"bestMoves": {"1": 1, "2": 2}}, and the sound on/off choice,
 * saved separately as "on" or "off". Every failure (storage disabled, quota, corrupt data) degrades
 * to the defaults (no saved progress, sound on) rather than an error.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SafeZoneStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // v1 recorded over-limit attempts as completed and contains no scores to validate.
  // Leave those records intact, but only use scored v2 progress for unlocking.
  const KEY = 'safezone.v2';
  const SOUND_KEY = 'safezone.sound';

  function parseProgress(text, levels) {
    try {
      const data = JSON.parse(text);
      if (data && data.bestMoves && typeof data.bestMoves === 'object' && !Array.isArray(data.bestMoves)) {
        return new Map(Object.entries(data.bestMoves)
          .map(([n, moves]) => [Number(n), moves])
          .filter(([n, moves]) => isPassingScore(n, moves, levels)));
      }
    } catch (e) { /* corrupt: fall through */ }
    return new Map();
  }

  function load(storage, levels) {
    try { return storage ? parseProgress(storage.getItem(KEY), levels) : new Map(); } catch (e) { return new Map(); }
  }

  function save(storage, completed) {
    try {
      if (storage) storage.setItem(KEY, JSON.stringify({ bestMoves: Object.fromEntries([...completed].sort(([a], [b]) => a - b)) }));
    } catch (e) { /* progress still lives in memory for this session */ }
  }

  function isPassingScore(n, moves, levels) {
    return Number.isInteger(n) && n >= 1 && n <= levels.length &&
      Number.isInteger(moves) && moves >= 1 && moves <= levels[n - 1].solution.length;
  }

  function isUnlocked(n, completed, levels) {
    if (!Number.isInteger(n) || n < 1 || n > levels.length) return false;
    for (let previous = 1; previous < n; previous++) {
      if (!isPassingScore(previous, completed.get(previous), levels)) return false;
    }
    return true;
  }

  function loadSoundOn(storage) {
    try { return !storage || storage.getItem(SOUND_KEY) !== 'off'; } catch (e) { return true; }
  }

  function saveSoundOn(storage, on) {
    try {
      if (storage) storage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch (e) { /* the choice still holds for this session */ }
  }

  return { KEY, SOUND_KEY, parseProgress, load, save, isUnlocked, loadSoundOn, saveSoundOn };
});
