// Checks how live weather codes map onto what the scene shows.

import assert from "node:assert/strict";
import { test } from "node:test";

import { describeWeather, isDaytimeInNewYork, sceneWeather } from "../src/weather.js";

test("weather codes map to the scene kinds", () => {
  assert.equal(describeWeather(0).kind, "clear");
  assert.equal(describeWeather(3).kind, "cloudy");
  assert.equal(describeWeather(45).kind, "fog");
  assert.equal(describeWeather(53).kind, "rain");
  assert.equal(describeWeather(73).kind, "snow");
  assert.equal(describeWeather(81).kind, "rain");
  assert.equal(describeWeather(96).kind, "storm");
});

test("a rainy night becomes gloomy rain at night", () => {
  const weather = sceneWeather({
    weather_code: 63, temperature_2m: 51.6, is_day: 0, cloud_cover: 90, wind_direction_10m: 200, wind_speed_10m: 12,
  });
  assert.equal(weather.precipitation, "rain");
  assert.equal(weather.isDay, false);
  assert.equal(weather.cover, 0.9);
  assert.equal(weather.temperatureF, 52);
  assert.ok(weather.gloom > 0.5);
});

test("New York daytime follows the New York clock", () => {
  assert.equal(isDaytimeInNewYork(new Date("2026-10-25T16:00:00Z")), true); // noon EDT
  assert.equal(isDaytimeInNewYork(new Date("2026-10-25T06:00:00Z")), false); // 2 am EDT
});
