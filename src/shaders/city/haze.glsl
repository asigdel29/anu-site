// Shared by the city shaders: air between the camera and the city, thicker low down,
// so the far city and the streets melt into the live sky colour.

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
