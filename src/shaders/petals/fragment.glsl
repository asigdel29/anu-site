// Draws one spinning petal per point and blends day coral to night silver-pink.
// Colours are sRGB, written straight out like the theme shader.

vec2 rotate2D(vec2 value, float angle)
{
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c) * value;
}

uniform float uMixRatio;

varying float vAlpha;
varying float vAngle;

void main()
{
    vec2 uv = rotate2D(gl_PointCoord - 0.5, vAngle);
    float edge = length(uv * vec2(2.0, 1.0));
    if (edge > 0.5) discard;

    vec3 dayColor = vec3(0.941, 0.392, 0.490);
    vec3 nightColor = vec3(0.871, 0.800, 0.902);
    vec3 color = mix(dayColor, nightColor, uMixRatio) * (1.0 - edge * 0.35);

    gl_FragColor = vec4(color, vAlpha);
}
