// Stylized park trees: round canopy lobes in soft cel light (a warm key and a cool blue-purple
// shade), dark at the core and bright at the top, a warm rim where the light grazes the edge,
// brown trunks, and deep blue with moonlit tops by night; hazed like the rest of the city.

uniform float uMixRatio;
uniform vec3 uTreePalette[7];

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vCanopy;
varying float vColor;
varying float vTone;

void main()
{
    vec3 normal = normalize(vNormal);
    vec3 toCamera = normalize(cameraPosition - vWorld);
    float leaf = step(-0.5, vCanopy.x);
    vec3 base = mix(vec3(0.45, 0.28, 0.17), uTreePalette[int(vColor + 0.5)] * (0.9 + 0.2 * vTone), leaf);
    // Deep inside the canopy and low down is dark; the outer top is bright.
    float depth = mix(1.0, mix(0.5, 1.15, clamp(0.55 * vCanopy.x + 0.45 * vCanopy.y, 0.0, 1.0)), leaf);
    float rim = leaf * pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
    // Only the theme in view is shaded; both blend while the theme changes.
    vec3 color = vec3(0.0);
    if (uMixRatio < 1.0)
    {
        float sunSide = smoothstep(-0.05, 0.3, dot(normal, SUN));
        color = base * mix(SHADE, SUN_COLOR, sunSide) * depth + vec3(1.0, 0.95, 0.7) * 0.3 * rim * sunSide;
    }
    if (uMixRatio > 0.0)
    {
        vec3 night = base * vec3(0.1, 0.12, 0.2) * depth + vec3(0.03, 0.035, 0.09) + vec3(0.05, 0.07, 0.16) * max(normal.y, 0.0) + vec3(0.08, 0.1, 0.25) * rim;
        color = mix(color, night, uMixRatio);
    }
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld)), 1.0);
}
