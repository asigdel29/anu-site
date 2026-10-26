// Passes the canopy's baked day and night vertex colours to the fragment shader, and sways the
// canopy gently in the wind: more toward the top, and in waves that roll across it.

attribute vec3 dayColor;
attribute vec3 nightColor;

uniform float uTime;

varying vec3 vDayColor;
varying vec3 vNightColor;
varying vec3 vWorld;

void main()
{
    vec4 world = modelMatrix * vec4(position, 1.0);
    float reach = smoothstep(3.4, 6.8, world.y);
    world.x += sin(uTime * 1.1 + world.x * 0.7 + world.z * 0.5) * 0.06 * reach;
    world.z += cos(uTime * 0.9 + world.x * 0.5) * 0.04 * reach;
    gl_Position = projectionMatrix * viewMatrix * world;
    vDayColor = dayColor;
    vNightColor = nightColor;
    vWorld = world.xyz;
}
