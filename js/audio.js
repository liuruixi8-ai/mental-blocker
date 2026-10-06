/*
 * Sound: the swipe effect. Browsers only allow audio after a user gesture, so the first press or
 * key press unlocks it. This is a plain <audio> element rather than Web Audio, so the game still
 * works when index.html is opened from disk.
 */
(function () {
  'use strict';

  const Store = window.SafeZoneStorage;

  const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

  const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  let soundOn = Store.loadSoundOn(storage);
  let unlocked = false; // the swipe has been played once from a gesture
  let unlocking = false;
  let playbackVersion = 0;

  const swipe = new Audio('audio/Swipe.wav');
  swipe.preload = 'auto';

  function markUnlocked() {
    unlocked = true;
    GESTURES.forEach(type => document.removeEventListener(type, unlock, true));
  }

  function unlock() {
    if (unlocked || unlocking || !soundOn) return;
    unlocking = true;
    const version = playbackVersion;
    // Wait for actual playback: pausing immediately can abort play() before audio is unlocked.
    swipe.play().then(() => {
      markUnlocked();
      // A slide may have started while play() was pending. Don't cut off that sound.
      if (version === playbackVersion) {
        swipe.pause();
        swipe.currentTime = 0;
      }
    }).catch(() => {
      // Keep the gesture listeners so a blocked or interrupted attempt can be retried.
    }).finally(() => { unlocking = false; });
  }

  GESTURES.forEach(type => document.addEventListener(type, unlock, true));

  function playSwipe() {
    if (!soundOn) return;
    playbackVersion++;
    swipe.currentTime = 0;
    swipe.play().then(markUnlocked).catch(() => {});
  }

  /* Turns sound on or off and remembers the choice. */
  function setSoundOn(on) {
    soundOn = on;
    Store.saveSoundOn(storage, on);
    if (on) unlock();
    else swipe.pause();
  }

  window.SafeZoneAudio = { playSwipe, isSoundOn: () => soundOn, setSoundOn };
})();
