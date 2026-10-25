// Falling cherry blossom petals. Each point loops from the canopy to below the island, swaying
// and drifting with the wind, so the CPU only updates uTime and never reallocates.

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
varying float vFlip;
varying float vTint;

void main()
{
    // position.xz is a point in the unit disc; position.y is the start phase (0..1).
    float speed = 0.03 + aSeed * 0.03;
    float t = fract(position.y + uTime * speed);

    vec3 petal = vec3(position.x * uRadius, uTop - t * uFall, position.z * uRadius);
    // A slow sway that grows as the petal falls, plus a fast flutter.
    float sway = 0.25 + t * 1.1;
    petal.x += sin(uTime * (0.5 + aSeed) + aSeed * 40.0) * sway + sin(uTime * 3.1 + aSeed * 9.0) * 0.06;
    petal.z += cos(uTime * (0.45 + aSeed * 0.7) + aSeed * 20.0) * sway;
    petal.xz += uWind * t * uFall;

    vec4 viewPosition = modelViewMatrix * vec4(petal, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * uPixelRatio * (0.7 + aSeed * 0.6) / -viewPosition.z;

    // Fade in under the canopy and out far below the island.
    vAlpha = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.8, 1.0, t));
    vAngle = uTime * (aSeed - 0.5) * 3.0 + aSeed * 6.2831;
    // The tumble: the petal's width swings as it turns over in the air.
    vFlip = 0.35 + 0.65 * abs(sin(uTime * (1.0 + aSeed * 1.5) + aSeed * 17.0));
    vTint = fract(aSeed * 13.7);
}
