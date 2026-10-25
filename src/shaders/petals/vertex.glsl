// Falling cherry blossom petals. Each point loops from the canopy to below the island,
// so the CPU only updates uTime and never reallocates.

uniform float uTime;
uniform float uTop;
uniform float uFall;
uniform float uRadius;
uniform float uSize;
uniform float uPixelRatio;
uniform vec2 uWind;

attribute float aSeed;

varying float vAlpha;
varying float vAngle;

void main()
{
    // position.xz is a point in the unit disc; position.y is the start phase (0..1).
    float speed = 0.035 + aSeed * 0.035;
    float t = fract(position.y + uTime * speed);

    vec3 petal = vec3(position.x * uRadius, uTop - t * uFall, position.z * uRadius);
    float sway = 0.2 + t * 0.9;
    petal.x += sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * sway;
    petal.z += cos(uTime * (0.5 + aSeed * 0.7) + aSeed * 20.0) * sway;
    petal.xz += uWind * t * uFall;

    vec4 viewPosition = modelViewMatrix * vec4(petal, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * uPixelRatio * (0.7 + aSeed * 0.6) / -viewPosition.z;

    vAlpha = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.85, 1.0, t));
    vAngle = uTime * (aSeed - 0.5) * 4.0 + aSeed * 6.2831;
}
