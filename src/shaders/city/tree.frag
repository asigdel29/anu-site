// Park tree crowns: flat-shaded facets lit by the sun by day, dark with a little moonlight
// by night, hazed like the rest of the city.

uniform float uMixRatio;
uniform vec3 uTreePalette[7];

varying vec3 vWorld;
varying float vColor;

const vec3 SUN = vec3(0.45, 0.8, 0.4);

void main()
{
    // Facet normal from screen-space derivatives: low-poly shading without normal data.
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 base = uTreePalette[int(vColor + 0.5)];
    vec3 day = base * (0.62 + 0.38 * max(dot(normal, normalize(SUN)), 0.0));
    vec3 night = base * 0.12 + vec3(0.02, 0.035, 0.05);
    gl_FragColor = vec4(mix(mix(day, night, uMixRatio), uSky, hazeAmount(vWorld)), 1.0);
}
