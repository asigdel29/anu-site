// Park tree crowns: facets lit by the shared city sun by day, deep candy shades with a lilac moon
// light on top by night, hazed like the rest of the city.

uniform float uMixRatio;
uniform vec3 uTreePalette[7];

varying vec3 vWorld;
varying float vColor;

const vec3 MOON = vec3(-0.5, 0.7, -0.3);

void main()
{
    // Facet normal from screen-space derivatives: low-poly shading without normal data.
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 base = uTreePalette[int(vColor + 0.5)];
    vec3 day = base * (0.78 + 0.26 * max(dot(normal, normalize(SUN)), 0.0));
    vec3 night = base * 0.24 + vec3(0.05, 0.04, 0.15) + vec3(0.1, 0.08, 0.2) * max(dot(normal, normalize(MOON)), 0.0);
    gl_FragColor = vec4(mix(mix(day, night, uMixRatio), uSky, hazeAmount(vWorld)), 1.0);
}
