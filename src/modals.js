// Work, about and contact dialogs: open and close by CSS class, keep focus inside,
// close on Escape or the overlay, and make the page behind them inert.

import { playClick } from "./toggles.js";

const modals = {
  work: document.querySelector(".modal.work"),
  about: document.querySelector(".modal.about"),
  contact: document.querySelector(".modal.contact"),
};
const overlay = document.querySelector(".overlay");

/**
 * Page parts behind the loading screen and dialogs; inert keeps keyboard focus out of them.
 * index.html marks them inert from the start, so the loading screen needs no script.
 */
const backgroundParts = [
  ".pill-nav",
  ".sky-status",
  ".hero-card",
  "#experience",
].flatMap((selector) => [...document.querySelectorAll(selector)]);

let openModal = null;
let focusBeforeModal = null;

/** Makes the page behind a dialog or the loading screen unreachable by keyboard. */
export function setBackgroundInert(isInert) {
  for (const element of backgroundParts) element.inert = isInert;
}

export function isModalOpen() {
  return openModal !== null;
}

/** Opens a dialog by name ("work", "about", "contact") and moves focus into it. */
export function showModal(name) {
  if (openModal) return;
  openModal = modals[name];
  focusBeforeModal = document.activeElement;
  setBackgroundInert(true);
  openModal.classList.add("is-open");
  overlay.classList.add("is-open");
  openModal.querySelector(".modal-exit-button").focus({ preventScroll: true });
}

/** Closes the open dialog and gives focus back to where it was. */
export function hideModal() {
  if (!openModal) return;
  openModal.classList.remove("is-open");
  overlay.classList.remove("is-open");
  openModal = null;
  setBackgroundInert(false);
  focusBeforeModal?.focus?.({ preventScroll: true });
}

overlay.addEventListener("click", hideModal);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideModal();
});

for (const button of document.querySelectorAll(".modal-exit-button")) {
  button.addEventListener("click", () => {
    playClick();
    hideModal();
  });
}

for (const button of document.querySelectorAll("[data-modal]")) {
  button.addEventListener("click", () => {
    playClick();
    showModal(button.dataset.modal);
  });
}
