// Sound and day/night toggles. Audio uses plain <audio> elements; the theme blend is
// stepped by the frame loop.

import { damp } from "./motion.js";

const music = new Audio("/audio/music/island.mp3");
music.loop = true;
music.volume = 0.6;
// The 385 KB loop downloads only when someone turns sound on.
music.preload = "none";

const click = new Audio("/audio/sfx/click.mp3");
click.volume = 0.5;

const muteButton = document.querySelector(".mute-toggle-button");
const themeButton = document.querySelector(".theme-toggle-button");

let isMuted = false;

/** Theme blend: 0 is day, 1 is night. The frame loop eases `mix` toward `target`. */
export const theme = { mix: 0, target: 0 };

/** Plays the click sound from the start, unless muted. */
export function playClick() {
  if (isMuted) return;
  click.currentTime = 0;
  click.play().catch(() => {});
}

/** Starts the music loop if sound is on. */
export function startMusic() {
  if (!isMuted && music.paused) music.play().catch(() => {});
}

/** Mutes or unmutes everything and syncs the button state. */
export function setMuted(muted) {
  isMuted = muted;
  music.muted = muted;
  click.muted = muted;
  muteButton.setAttribute("aria-pressed", String(muted));
}

muteButton.addEventListener("click", () => {
  setMuted(!isMuted);
  playClick();
  startMusic();
});

/** Switches to night or day; the frame loop eases the scene into it. */
export function setNight(isNight) {
  theme.target = isNight ? 1 : 0;
  document.body.classList.toggle("dark-theme", isNight);
  document.body.classList.toggle("light-theme", !isNight);
  themeButton.setAttribute("aria-pressed", String(isNight));
}

themeButton.addEventListener("click", () => {
  setNight(theme.target === 0);
  playClick();
});

/** Eases the theme blend; returns true while it is still changing. */
export function stepTheme(delta) {
  if (theme.mix === theme.target) return false;
  theme.mix = damp(theme.mix, theme.target, 3, delta);
  return true;
}
