// Cloud colour: puffy white with a soft blue shade by day, lilac at night, a lavender grey in
// bad weather.
// Colours are sRGB, written straight out like the theme shader.

uniform float uMixRatio;
uniform float uGloom;

varying float vShade;

void main()
{
    vec3 dayLight = vec3(1.0);
    vec3 dayShadow = vec3(0.78, 0.87, 0.98);
    vec3 nightLight = vec3(0.56, 0.5, 0.84);
    vec3 nightShadow = vec3(0.24, 0.2, 0.46);

    vec3 light = mix(dayLight, nightLight, uMixRatio);
    vec3 shadow = mix(dayShadow, nightShadow, uMixRatio);
    vec3 color = mix(shadow, light, vShade);
    color = mix(color, vec3(dot(color, vec3(0.33))) * vec3(0.8, 0.8, 0.9), uGloom);

    gl_FragColor = vec4(color, 1.0);
}
