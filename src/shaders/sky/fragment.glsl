// Sky colour by direction: the horizon colour low down, a deeper blue overhead, a warm glow around
// the sun by day and small twinkle-free stars at night. Colours are sRGB, like the other scene shaders.

uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uMixRatio;

varying vec3 vDirection;

const vec3 SUN = vec3(0.45, 0.8, 0.4);

float hash(vec3 p)
{
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main()
{
    vec3 direction = normalize(vDirection);
    float up = clamp(direction.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, pow(up, 0.55));

    // A soft warm glow around the sun, by day only.
    float sun = max(dot(direction, normalize(SUN)), 0.0);
    color += vec3(1.0, 0.86, 0.6) * (pow(sun, 24.0) * 0.35 + pow(sun, 400.0) * 0.6) * (1.0 - uMixRatio);

    // Stars: one possible star per small cell of the sky, above the haze, at night only.
    vec3 cell = floor(direction * 180.0);
    float star = step(0.9975, hash(cell)) * smoothstep(0.08, 0.3, up);
    color += vec3(0.9, 0.92, 1.0) * star * uMixRatio;

    gl_FragColor = vec4(color, 1.0);
}
