'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const listeners = new Map();
  const pending = [];
  const media = {
    currentTime: 0,
    paused: true,
    pauses: 0,
    play() {
      this.paused = false;
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
    pause() { this.paused = true; this.pauses++; },
  };
  const window = { SafeZoneStorage: { loadSoundOn: () => true, saveSoundOn() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../js/audio.js'), 'utf8'), {
    window,
    Audio: function () { return media; },
    document: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: type => listeners.delete(type),
    },
  });
  return { media, pending, listeners, sound: window.SafeZoneAudio };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('audio unlock waits for successful playback before pausing (#7)', async () => {
  const { media, pending, listeners } = setup();
  listeners.get('pointerdown')();
  assert.equal(media.pauses, 0, 'do not interrupt the pending play request');
  assert.ok(listeners.size > 0, 'keep gestures until playback succeeds');
  pending.shift().resolve();
  await flush();
  assert.equal(media.pauses, 1);
  assert.equal(listeners.size, 0);
});

test('rejected audio unlock retries on the next user gesture (#7)', async () => {
  const { pending, listeners } = setup();
  listeners.get('pointerdown')();
  pending.shift().reject(new Error('NotAllowedError'));
  await flush();
  assert.ok(listeners.has('touchend'));
  listeners.get('touchend')();
  assert.equal(pending.length, 1);
  pending.shift().resolve();
  await flush();
  assert.equal(listeners.size, 0);
});

test('audio unlock does not interrupt a slide that starts while it is pending (#7)', async () => {
  const { media, pending, listeners, sound } = setup();
  listeners.get('pointerdown')();
  sound.playSwipe();
  for (const request of pending) request.resolve();
  await flush();
  assert.equal(media.pauses, 0);
  assert.equal(media.paused, false);
  sound.setSoundOn(false);
  assert.equal(media.paused, true, 'muting stops playback');
});
