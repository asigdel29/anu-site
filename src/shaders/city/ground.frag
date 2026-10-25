// The city floor: Manhattan's streets and blocks, Central Park with its reservoir, the
// rivers, and borough land, hazed into the sky. Street lights glow along the grid at night.
// PARK, MANHATTAN, GRID, AVENUE_ORIGIN and BOROUGH_EDGE come from src/city.js as defines.

uniform float uMixRatio;
uniform float uTime;

varying vec3 vCity;
varying vec3 vWorld;

// Running integral of a pulse that is 1 on [from, to] in every unit cell.
float pulseIntegral(float x, float from, float to)
{
    return floor(x) * (to - from) + clamp(fract(x), from, to) - from;
}

float filteredPulse(float x, float width, float from, float to)
{
    width = max(width, 1e-4);
    return (pulseIntegral(x + 0.5 * width, from, to) - pulseIntegral(x - 0.5 * width, from, to)) / width;
}

void main()
{
    float x = vCity.x;
    float z = vCity.z;
    float halfWidth = MANHATTAN.z - max(z - MANHATTAN.w, 0.0) / (MANHATTAN.y - MANHATTAN.w) * (MANHATTAN.z - 60.0);
    float manhattan = step(abs(x), halfWidth) * step(MANHATTAN.x, z) * step(z, MANHATTAN.y);
    float borough = step(BOROUGH_EDGE, abs(x)) * step(z, MANHATTAN.y + 30.0);
    float land = max(max(manhattan, borough), step(z, MANHATTAN.x - 8.0));
    float park = step(PARK.x, x) * step(x, PARK.y) * step(PARK.z, z) * step(z, PARK.w);
    float reservoir = park * step(length((vCity.xz - vec2(0.0, -150.0)) / vec2(30.0, 26.0)), 1.0);

    // Street mask: 1 on avenues and streets, 0 on blocks.
    vec2 grid = vec2((x - AVENUE_ORIGIN) / GRID.x, (z - MANHATTAN.x) / GRID.z);
    vec2 width = fwidth(grid);
    float avenue = filteredPulse(grid.x + 0.5 * GRID.y / GRID.x, width.x, 0.0, GRID.y / GRID.x);
    float street = filteredPulse(grid.y + 0.5 * GRID.w / GRID.z, width.y, 0.0, GRID.w / GRID.z);
    float road = max(avenue, street) * manhattan * (1.0 - park);

    float ripple = 0.03 * sin(vCity.x * 0.12 + uTime * 0.6) * sin(vCity.z * 0.09 - uTime * 0.4);
    vec3 dayWater = mix(vec3(0.36, 0.55, 0.68), uSky, 0.35) + ripple;
    vec3 dayLand = mix(vec3(0.66, 0.65, 0.62), vec3(0.44, 0.45, 0.48), road);
    vec3 day = mix(dayWater, mix(dayLand, vec3(0.47, 0.69, 0.42), park), land);
    day = mix(day, dayWater, reservoir);

    vec3 nightWater = mix(vec3(0.03, 0.05, 0.1), uSky, 0.25) + ripple * 0.5;
    vec3 nightLand = vec3(0.05, 0.05, 0.08) + vec3(1.0, 0.7, 0.36) * 0.4 * road;
    vec3 night = mix(nightWater, mix(nightLand, vec3(0.04, 0.08, 0.06), park), land);
    night = mix(night, nightWater, reservoir);

    vec3 color = mix(day, night, uMixRatio);
    float glow = road * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.4 * glow)), 1.0);
}
