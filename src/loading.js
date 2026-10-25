// Loading screen: shows "enter" once the island is ready, then drops away with a CSS
// animation and removes itself.

const loadingScreen = document.querySelector(".loading-screen");
const enterButton = document.querySelector(".loading-screen-button");
const noSoundButton = document.querySelector(".no-sound-button");

/** Turns the loading button into "enter"; resolves with true for sound, false for silence. */
export function waitForEnter() {
  loadingScreen.classList.add("is-ready");
  enterButton.textContent = "enter";
  enterButton.disabled = false;
  noSoundButton.hidden = false;

  return new Promise((resolve) => {
    enterButton.addEventListener("click", () => resolve(true), { once: true });
    noSoundButton.addEventListener("click", () => resolve(false), { once: true });
  });
}

/** Plays the drop-away animation and resolves once the loading screen is gone. */
export function revealIsland() {
  noSoundButton.hidden = true;
  enterButton.textContent = "~ hey ~";
  enterButton.disabled = true;
  loadingScreen.classList.add("is-leaving");

  return new Promise((resolve) => {
    loadingScreen.addEventListener(
      "animationend",
      () => {
        loadingScreen.remove();
        resolve();
      },
      { once: true }
    );
  });
}
