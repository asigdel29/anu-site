// The city floor as a toy map: sand-coloured Manhattan with pale streets, a bright green Central
// Park with its water and lawns, cyan rivers, and pastel borough land, hazed into the sky.
// Street lights glow along the grid at night.
// PARK, MANHATTAN, GRID, AVENUE_ORIGIN and BOROUGH_EDGE come from src/city.js as defines.

uniform float uMixRatio;
uniform float uTime;
uniform vec4 uParkWater[3]; // ellipses: centre x, z, radius x, z
uniform vec4 uParkLawns[2];

varying vec3 vCity;
varying vec3 vWorld;

float inEllipse(vec4 ellipse)
{
    return step(length((vCity.xz - ellipse.xy) / ellipse.zw), 1.0);
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
    float pond = park * max(max(inEllipse(uParkWater[0]), inEllipse(uParkWater[1])), inEllipse(uParkWater[2]));
    float lawn = park * max(inEllipse(uParkLawns[0]), inEllipse(uParkLawns[1]));

    // Street mask: 1 on avenues and streets, 0 on blocks.
    vec2 grid = vec2((x - AVENUE_ORIGIN) / GRID.x, (z - MANHATTAN.x) / GRID.z);
    vec2 width = fwidth(grid);
    float avenue = filteredPulse(grid.x + 0.5 * GRID.y / GRID.x, width.x, 0.0, GRID.y / GRID.x);
    float street = filteredPulse(grid.y + 0.5 * GRID.w / GRID.z, width.y, 0.0, GRID.w / GRID.z);
    float road = max(avenue, street) * manhattan * (1.0 - park);

    float ripple = 0.03 * sin(vCity.x * 0.12 + uTime * 0.6) * sin(vCity.z * 0.09 - uTime * 0.4);
    vec3 dayWater = mix(vec3(0.42, 0.83, 0.97), uSky, 0.2) + ripple;
    // Sand blocks with pale cream streets, lilac New Jersey to the west and pink Brooklyn and Queens to the east.
    vec3 boroughLand = mix(vec3(0.85, 0.78, 0.96), vec3(0.98, 0.78, 0.84), step(0.0, x));
    vec3 dayLand = mix(mix(vec3(0.96, 0.86, 0.66), vec3(1.0, 0.96, 0.9), road), boroughLand, borough);
    vec3 dayPark = mix(vec3(0.48, 0.8, 0.42), vec3(0.65, 0.91, 0.5), lawn);
    vec3 day = mix(dayWater, mix(dayLand, dayPark, park), land);
    day = mix(day, dayWater, pond);

    vec3 nightWater = mix(vec3(0.08, 0.1, 0.32), uSky, 0.25) + ripple * 0.5;
    vec3 nightLand = vec3(0.12, 0.09, 0.22) + vec3(1.0, 0.72, 0.5) * 0.4 * road;
    vec3 night = mix(nightWater, mix(nightLand, vec3(0.08, 0.15, 0.25), park), land);
    night = mix(night, nightWater, pond);

    vec3 color = mix(day, night, uMixRatio);
    float glow = road * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.4 * glow)), 1.0);
}
