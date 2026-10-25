// The city floor in a sunny stylized look: dark teal-blue asphalt with lane dashes and chunky
// crosswalks, warm sidewalks, lush park greens with drives and a clay running track, bright
// blue-teal water with a foam line along the shores and twinkling glints, and warm boroughs with
// their own street grid. At night street lights glow orange along the grid and in the rivers.
// PARK, MANHATTAN, GRID, AVENUE_ORIGIN, BOROUGH_EDGE and TRANSVERSES come from src/city.js as defines.

uniform float uMixRatio;
uniform float uTime;
uniform vec4 uParkWater[3]; // ellipses: centre x, z, radius x, z
uniform vec4 uParkLawns[2];

varying vec3 vCity;
varying vec3 vWorld;

const vec3 ASPHALT = vec3(0.17, 0.25, 0.32);
const vec3 SIDEWALK = vec3(0.92, 0.8, 0.62);
const vec3 SODIUM = vec3(1.0, 0.6, 0.25);

float inEllipse(vec4 ellipse)
{
    return step(length((vCity.xz - ellipse.xy) / ellipse.zw), 1.0);
}

// Antialiased band of the given width centred on every multiple of spacing.
float gridLine(float coord, float spacing, float width)
{
    float cell = coord / spacing + 0.5 * width / spacing;
    return filteredPulse(cell, fwidth(cell), 0.0, width / spacing);
}

// Antialiased stripes: the given share of every period, along a coordinate in metres.
float stripes(float coord, float period, float share)
{
    float cell = coord / period;
    return filteredPulse(cell, fwidth(cell), 0.0, share);
}

// Antialiased line of the given half width along the zero contour of a distance in metres.
float contour(float distance, float halfWidth)
{
    float pixel = fwidth(distance);
    return 1.0 - smoothstep(halfWidth - pixel, halfWidth + pixel, abs(distance));
}

// Smooth value noise, for the patches of trees and yards in the boroughs.
float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
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

    // Manhattan: each avenue and street is an asphalt roadway with a sidewalk on each side.
    float avenueX = x - AVENUE_ORIGIN;
    float streetZ = z - MANHATTAN.x;
    float city = manhattan * (1.0 - park);
    float avenue = gridLine(avenueX, GRID.x, GRID.y) * city;
    float street = gridLine(streetZ, GRID.z, GRID.w) * city;
    float avenueRoad = gridLine(avenueX, GRID.x, GRID.y - 0.9) * city;
    float streetRoad = gridLine(streetZ, GRID.z, GRID.w - 0.6) * city;
    float roadway = max(avenueRoad, streetRoad);
    float paved = max(avenue, street);
    // Lane dashes down the avenues, and zebra crosswalks where the sidewalks meet a roadway.
    float lanes = avenueRoad * (1.0 - street) * stripes(z, 1.0, 0.45)
        * max(gridLine(avenueX - 0.35, GRID.x, 0.06), gridLine(avenueX + 0.35, GRID.x, 0.06));
    float crosswalks = avenueRoad * (street - streetRoad) * stripes(x, 0.24, 0.5)
        + streetRoad * (avenue - avenueRoad) * stripes(z, 0.24, 0.5);
    // The boroughs: wider blocks, with roads in the gaps layoutCity leaves between them.
    float outer = land * (1.0 - manhattan);
    float boroughRoad = outer * max(gridLine(abs(x) - BOROUGH_EDGE, GRID.x, 3.0), gridLine(streetZ, 2.0 * GRID.z, 1.2));

    // Central Park: the loop drive inside its edges (north of the Pond), the sunken transverse
    // roads, and the running track around the Reservoir.
    vec2 loopCentre = vec2(0.0, 0.5 * (PARK.z + 6.0 + PARK.w - 9.0));
    vec2 loopHalf = vec2(PARK.y - 5.0, 0.5 * (PARK.w - 9.0 - PARK.z - 6.0));
    vec2 inset = abs(vCity.xz - loopCentre) - loopHalf + 14.0;
    float drive = contour(length(max(inset, 0.0)) + min(max(inset.x, inset.y), 0.0) - 14.0, 0.45);
    vec4 transverse = abs(z - TRANSVERSES);
    float crossing = contour(min(min(transverse.x, transverse.y), min(transverse.z, transverse.w)), 0.4);
    float trackRadius = length((vCity.xz - uParkWater[0].xy) / uParkWater[0].zw);
    float track = contour((trackRadius - 1.05) * uParkWater[0].z, 0.3);

    // Water: bright blue-teal, lighter in the shallows, mirroring more sky at grazing angles, with a
    // wobbling foam line along every shore and glints that twinkle in the sun.
    float manhattanShore = max(abs(x) - halfWidth, max(MANHATTAN.x - z, z - MANHATTAN.y));
    float boroughShore = max(BOROUGH_EDGE - abs(x), z - MANHATTAN.y - 30.0);
    float shore = min(min(manhattanShore, boroughShore), z - MANHATTAN.x + 8.0);
    float pondShore = -1e3;
    for (int i = 0; i < 3; i++)
    {
        pondShore = max(pondShore, (length((vCity.xz - uParkWater[i].xy) / uParkWater[i].zw) - 1.0) * -uParkWater[i].w);
    }
    shore = mix(shore, pondShore, pond);
    float foam = contour(shore - 0.35 - 0.15 * sin(vWorld.x * 0.8 + vWorld.z * 0.6 + uTime * 1.4), 0.2);
    vec3 toCamera = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(toCamera.y, 0.0, 1.0), 4.0);
    vec2 glintCell = vWorld.xz / 1.4;
    vec2 glintSpot = fract(glintCell) - 0.5;
    float twinkle = step(fract(uTime * 0.35 + hash(floor(glintCell))), 0.12);
    float glint = twinkle * (1.0 - smoothstep(0.06, 0.12, abs(glintSpot.x) + abs(glintSpot.y))) * (1.0 - smoothstep(0.08, 0.25, fwidth(glintCell.x)));
    vec3 dayWater = mix(vec3(0.1, 0.5, 0.72), vec3(0.28, 0.78, 0.84), exp(-shore / 5.0));
    dayWater = mix(dayWater, uSky, 0.15 + 0.55 * fresnel);
    dayWater = mix(dayWater, vec3(0.92, 0.98, 1.0), max(foam * 0.85, glint));

    vec3 manhattanDay = mix(vec3(0.78, 0.66, 0.52), SIDEWALK, paved);
    manhattanDay = mix(manhattanDay, ASPHALT, roadway);
    manhattanDay = mix(manhattanDay, vec3(0.95, 0.95, 0.92), max(lanes * 0.6, crosswalks * 0.8));
    float cover = smoothstep(0.45, 0.75, 0.7 * noise(vCity.xz * 0.035) + 0.3 * noise(vCity.xz * 0.11));
    vec3 boroughDay = mix(vec3(0.8, 0.62, 0.48), vec3(0.36, 0.66, 0.3), cover);
    boroughDay = mix(boroughDay, ASPHALT, boroughRoad);
    vec3 parkDay = mix(vec3(0.22, 0.52, 0.2), vec3(0.47, 0.78, 0.27), lawn);
    parkDay = mix(parkDay, ASPHALT, max(drive, crossing));
    parkDay = mix(parkDay, vec3(0.88, 0.58, 0.4), track);
    vec3 landDay = mix(mix(boroughDay, manhattanDay, manhattan), parkDay, park);
    vec3 day = mix(mix(dayWater, landDay, land), dayWater, pond);

    // Night: deep blue-purple ground, orange light on the roadways and brighter at the corners,
    // lamps along the park drives, and the city's lights shimmering in the water near the shore.
    float corner = avenue * street;
    float shimmer = 0.6 + 0.4 * sin(vWorld.x * 1.3 + uTime * 1.5) * sin(vWorld.z * 0.9 - uTime);
    vec3 nightWater = mix(vec3(0.04, 0.08, 0.2), uSky, 0.15 + 0.5 * fresnel) + SODIUM * 0.25 * exp(-max(shore, 0.0) / 6.0) * shimmer;
    vec3 nightLand = vec3(0.06, 0.06, 0.14) + SODIUM * (0.32 * roadway + 0.12 * paved + 0.3 * corner + 0.2 * boroughRoad);
    vec3 nightPark = vec3(0.04, 0.07, 0.1) + SODIUM * 0.22 * max(drive, track);
    vec3 night = mix(nightWater, mix(nightLand, nightPark, park), land);
    night = mix(night, nightWater, pond);

    vec3 color = mix(day, night, uMixRatio);
    float glow = max(paved, boroughRoad) * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.4 * glow)), 1.0);
}
