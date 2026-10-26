// Glass "dynamic island" docks: the nav and the hero card fold into small capsules a few seconds
// after the island appears, and open again on hover, keyboard focus or a tap.

/** How long the docks stay open after the island appears, and after a tap on a capsule. */
const OPEN_MS = 5000;
/** Grace time after the pointer or focus leaves, so a dock does not snap shut mid-move. */
const LEAVE_MS = 700;

const docks = [...document.querySelectorAll(".dock")];

/**
 * True after Tab and false after any other key or a pointer press. Focus that Tab moves in
 * opens a dock; focus that Escape gives back after a dialog does not, even though the browser
 * shows a focus ring for it.
 */
let tabbing = false;
window.addEventListener("keydown", (event) => {
  tabbing = event.key === "Tab";
}, true);
window.addEventListener("pointerdown", () => {
  tabbing = false;
}, true);

/**
 * Writes each dock's open size into --open-w and --open-h. CSS can animate between two lengths
 * but not to or from auto, so the open size must be a number.
 */
const openSizes = new ResizeObserver((entries) => {
  for (const { target, borderBoxSize } of entries) {
    const [box] = borderBoxSize;
    // A hidden dock measures 0; keep the last real size.
    if (box.inlineSize === 0) continue;
    const dock = target.closest(".dock");
    dock.style.setProperty("--open-w", `${box.inlineSize}px`);
    dock.style.setProperty("--open-h", `${box.blockSize}px`);
  }
});
for (const dock of docks) openSizes.observe(dock.querySelector(".island-body"));

/** Adds the open and close rules to one dock and starts its first-look timer. */
function wireDock(dock) {
  let timer = 0;
  let hovered = false;
  const open = () => {
    clearTimeout(timer);
    dock.classList.remove("is-collapsed");
  };
  const closeAfter = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => dock.classList.add("is-collapsed"), ms);
  };

  // Mouse only: a touch also sends enter and leave events, around every tap.
  dock.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    open();
  });
  dock.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    if (!(tabbing && dock.contains(document.activeElement))) closeAfter(LEAVE_MS);
  });
  // Tabbing in opens a dock; focus that a click or a closed dialog puts back does not.
  dock.addEventListener("focusin", () => {
    if (tabbing) open();
  });
  dock.addEventListener("focusout", (event) => {
    if (!hovered && !dock.contains(event.relatedTarget)) closeAfter(LEAVE_MS);
  });
  // Touch has no hover, so a tap on a capsule opens it for another few seconds.
  dock.addEventListener("click", () => {
    if (!dock.classList.contains("is-collapsed")) return;
    open();
    closeAfter(OPEN_MS);
  });

  closeAfter(OPEN_MS);
}

/** Starts the docks; call it once the island is on screen. */
export function startDocks() {
  for (const dock of docks) wireDock(dock);
}
