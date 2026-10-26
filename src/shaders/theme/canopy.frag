// Blends the canopy's baked day and night vertex colours by uMixRatio (0 = day, 1 = night), and
// adds a little flat light per facet, so the clumps read as crisp stylized facets.
// The colours are stored in sRGB; the blend runs in linear light, like the atlas shader's.

uniform float uMixRatio;

varying vec3 vDayColor;
varying vec3 vNightColor;
varying vec3 vWorld;

const vec3 SUN = vec3(0.45, 0.8, 0.4);

void main()
{
    vec3 color = mix(pow(vDayColor, vec3(2.2)), pow(vNightColor, vec3(2.2)), uMixRatio);
    // Facet normal from screen-space derivatives: flat shading without normal data.
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    float facet = 0.9 + 0.2 * max(dot(normal, normalize(SUN)), 0.0);
    color *= mix(facet, 1.0, uMixRatio);
    gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
