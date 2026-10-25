// Cloud colour in a stylized game look: warm white sunlit tops, cool blue-lavender bellies, and a
// bright rim where each puff turns away from the camera. Night is lilac; bad weather greys it.
// Colours are sRGB, written straight out like the theme shader.

uniform float uMixRatio;
uniform float uGloom;

varying float vShade;
varying float vRim;

void main()
{
    vec3 dayLight = vec3(1.0, 0.98, 0.94);
    vec3 dayShadow = vec3(0.66, 0.76, 0.95);
    vec3 nightLight = vec3(0.6, 0.54, 0.86);
    vec3 nightShadow = vec3(0.22, 0.19, 0.44);

    vec3 light = mix(dayLight, nightLight, uMixRatio);
    vec3 shadow = mix(dayShadow, nightShadow, uMixRatio);
    vec3 color = mix(shadow, light, vShade);
    color = mix(color, mix(vec3(1.0), vec3(0.78, 0.74, 1.0), uMixRatio), vRim * 0.55);
    color = mix(color, vec3(dot(color, vec3(0.33))) * vec3(0.8, 0.8, 0.9), uGloom);

    gl_FragColor = vec4(color, 1.0);
}
