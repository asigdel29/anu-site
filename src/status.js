// The corner status line (New York time and weather) and a one-time note that the island's
// weather is New York's weather right now.

const timeText = document.querySelector(".status-time");
const weatherText = document.querySelector(".status-weather");
const note = document.querySelector(".weather-note");

const newYorkClock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

function tick() {
  timeText.textContent = newYorkClock.format(new Date()).toLowerCase();
}

/** Shows New York time now and keeps it current. */
export function startClock() {
  tick();
  setInterval(tick, 30_000);
}

/** Writes the weather next to the clock, for example "44°f · overcast". */
export function showWeather(weather) {
  weatherText.textContent = Number.isFinite(weather.temperatureF)
    ? `${weather.temperatureF}°f · ${weather.label}`
    : weather.label;
}

/** Tells the visitor, once and for a few seconds, that the weather is live. */
export function noteWeather(weather) {
  if (!weather.live) return;
  note.querySelector(".weather-note-text").textContent =
    `it's ${weather.phrase} in new york right now, so it is here too.`;
  note.hidden = false;
  setTimeout(() => {
    note.hidden = true;
  }, 7000);
}
