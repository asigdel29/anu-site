// Draws one tumbling sakura petal per point: an oval with the notch at its outer tip, white at
// the base and pink toward the edge, silver-pink at night. Colours are sRGB, like the other
// scene shaders.

uniform float uMixRatio;

varying float vAlpha;
varying float vAngle;
varying float vFlip;
varying float vTint;

vec2 rotate2D(vec2 value, float angle)
{
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c) * value;
}

void main()
{
    // Petal space: y runs from the base (-0.5) to the tip (0.5); x is squeezed by the tumble.
    vec2 uv = rotate2D(gl_PointCoord - 0.5, vAngle);
    uv.x /= vFlip;
    float body = length(uv * vec2(2.2, 1.0) + vec2(0.0, 0.05));
    // The notch: a small bite out of the tip.
    float notch = length((uv - vec2(0.0, 0.5)) * vec2(3.0, 2.2));
    if (body > 0.5 || notch < 0.18) discard;

    vec3 base = vec3(1.0, 0.95, 0.97);
    vec3 edge = mix(vec3(1.0, 0.62, 0.76), vec3(1.0, 0.74, 0.84), vTint);
    vec3 day = mix(base, edge, smoothstep(0.05, 0.45, uv.y + 0.5 * body));
    vec3 night = mix(vec3(0.8, 0.74, 0.92), vec3(0.62, 0.52, 0.8), body * 2.0);
    vec3 color = mix(day, night, uMixRatio) * (1.0 - 0.18 * body);

    gl_FragColor = vec4(color, vAlpha);
}
