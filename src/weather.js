// Live New York weather from Open-Meteo (free, no key), turned into scene settings:
// cloud cover, wind, gloom, rain or snow, fog, thunder and day or night.

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006" +
  "&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day" +
  "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York";

/** Groups WMO weather codes into what the scene can show, with a short label. */
export function describeWeather(code) {
  if (code === 0) return { kind: "clear", label: "clear" };
  if (code <= 2) return { kind: "clear", label: "partly cloudy" };
  if (code === 3) return { kind: "cloudy", label: "overcast" };
  if (code === 45 || code === 48) return { kind: "fog", label: "fog" };
  if (code >= 51 && code <= 57) return { kind: "rain", label: "drizzle" };
  if (code >= 61 && code <= 67) return { kind: "rain", label: "rain" };
  if (code >= 71 && code <= 77) return { kind: "snow", label: "snow" };
  if (code >= 80 && code <= 82) return { kind: "rain", label: "showers" };
  if (code >= 85 && code <= 86) return { kind: "snow", label: "snow showers" };
  if (code >= 95) return { kind: "storm", label: "thunderstorm" };
  return { kind: "cloudy", label: "cloudy" };
}

/** Turns an Open-Meteo `current` block into the settings the scene uses. */
export function sceneWeather(current) {
  const { kind, label } = describeWeather(current.weather_code);
  const wet = kind === "rain" || kind === "storm" || kind === "snow";
  return {
    kind,
    label,
    temperatureF: Math.round(current.temperature_2m),
    isDay: current.is_day === 1,
    cover: current.cloud_cover / 100,
    windDegrees: current.wind_direction_10m,
    windMph: current.wind_speed_10m,
    gloom: wet ? 0.6 : kind === "fog" ? 0.4 : kind === "cloudy" ? 0.25 : 0,
    precipitation: kind === "snow" ? "snow" : wet ? "rain" : "none",
    fog: kind === "fog",
    thunder: kind === "storm",
  };
}

/** True between 6 am and 7 pm in New York; used when the forecast is unavailable. */
export function isDaytimeInNewYork(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(date)
  );
  return hour >= 6 && hour < 19;
}

/** Calm fallback weather for offline visits. */
export function calmWeather() {
  return {
    ...sceneWeather({ weather_code: 1, temperature_2m: NaN, is_day: 1, cloud_cover: 40, wind_direction_10m: 270, wind_speed_10m: 5 }),
    isDay: isDaytimeInNewYork(),
    live: false,
  };
}

/** Fetches current NYC weather; falls back to calm weather when offline or blocked. */
export async function fetchWeather() {
  try {
    const response = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return calmWeather();
    const { current } = await response.json();
    return { ...sceneWeather(current), live: true };
  } catch {
    return calmWeather();
  }
}
