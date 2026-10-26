// Shared by the city fragment shaders: the sun and shade lights, the haze between the camera and
// the city (a little thicker low down, so the far city and the streets melt into the live sky
// colour), an antialiased pulse for window and street grids, and a small hash.

uniform vec3 uSky;
uniform float uHaze;   // extra haze from the weather (fog, gloom)
uniform float uGround; // street level (world y)

// The sun of a clear afternoon, from the camera's side of the city, so the faces toward the
// camera are lit and the side walls fall into shade. SUN_COLOR is its warm key light and SHADE the
// cool blue-purple light in the shadows, as in a stylized game world.
const vec3 SUN = vec3(0.69, 0.69, 0.22);
const vec3 SUN_COLOR = vec3(1.12, 1.02, 0.88);
const vec3 SHADE = vec3(0.56, 0.58, 0.86);

// How much of the sky colour covers a point: more with distance and weather, and a little more
// near the street.
float hazeAmount(vec3 world)
{
    float distance = length(world - cameraPosition);
    float air = 1.0 - exp(-distance * (0.0011 + uHaze * 0.008));
    float low = 1.0 - smoothstep(0.0, 14.0, world.y - uGround);
    return clamp(air + (1.0 - air) * low * 0.12, 0.0, 1.0);
}

// Running integral of a pulse that is 1 on [from, to] in every unit cell.
float pulseIntegral(float x, float from, float to)
{
    return floor(x) * (to - from) + clamp(fract(x), from, to) - from;
}

// The pulse averaged over one pixel's width, so far grids blend instead of shimmering.
float filteredPulse(float x, float width, float from, float to)
{
    width = max(width, 1e-4);
    return (pulseIntegral(x + 0.5 * width, from, to) - pulseIntegral(x - 0.5 * width, from, to)) / width;
}

// A repeatable pseudo-random number in [0, 1) for a cell or a point.
// (Arithmetic only: no sine, which software WebGL works out slowly.)
float hash(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
