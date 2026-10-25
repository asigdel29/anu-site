// Rain or snow around the island. Each point loops from above the canopy to below the
// island; wind tilts rain and pushes snow, all computed here from uTime.

uniform float uTime;
uniform float uSnow;     // 0 = rain, 1 = snow
uniform vec2 uWind;      // drift per metre of fall, in the ground plane
uniform float uPixelRatio;

attribute float aSeed;

varying float vAlpha;

void main()
{
    float speed = mix(9.0, 0.9, uSnow) * (0.8 + aSeed * 0.4);
    float height = 26.0;
    float t = fract(position.y + uTime * speed / height);
    float fallen = t * height;

    vec3 drop = vec3(position.x * 15.0, 14.0 - fallen, position.z * 15.0);
    drop.xz += uWind * fallen;
    drop.x += uSnow * sin(uTime * 0.8 + aSeed * 40.0) * 0.6;

    vec4 viewPosition = modelViewMatrix * vec4(drop, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = mix(170.0, 130.0, uSnow) * uPixelRatio / -viewPosition.z;
    vAlpha = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.9, 1.0, t));
}
