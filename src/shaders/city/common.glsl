// Shared by the city fragment shaders: the haze between the camera and the city (thicker low
// down, so the far city and the streets melt into the live sky colour), and an antialiased pulse
// for window and street grids.

uniform vec3 uSky;
uniform float uHaze;   // extra haze from the weather (fog, gloom)
uniform float uGround; // street level (world y)

float hazeAmount(vec3 world)
{
    float distance = length(world - cameraPosition);
    float air = 1.0 - exp(-distance * (0.0019 + uHaze * 0.008));
    float low = 1.0 - smoothstep(0.0, 14.0, world.y - uGround);
    return clamp(air + (1.0 - air) * low * 0.25, 0.0, 1.0);
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
