// Red aviation lights on the tall tops: one point each, flashing about every two seconds,
// with neighbours drifting a little out of step.

attribute float aPhase;

uniform float uGround;
uniform float uTime;
uniform float uPixelRatio;

varying float vBlink;
varying vec3 vWorld;

void main()
{
    vec4 world = modelMatrix * vec4(position.x, uGround + position.y, position.z, 1.0);
    vec4 view = viewMatrix * world;
    vWorld = world.xyz;
    vBlink = 0.3 + 0.7 * step(0.5, fract(uTime * 0.5 + aPhase * 0.3));
    gl_PointSize = uPixelRatio * clamp(500.0 / -view.z, 2.0, 5.0);
    gl_Position = projectionMatrix * view;
}
