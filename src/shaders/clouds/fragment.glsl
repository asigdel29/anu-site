// Cloud colour: white with lavender shade by day, blue-grey at night, greyer in bad weather.
// Colours are sRGB, written straight out like the theme shader.

uniform float uMixRatio;
uniform float uGloom;

varying float vShade;

void main()
{
    vec3 dayLight = vec3(0.98, 0.98, 1.0);
    vec3 dayShadow = vec3(0.78, 0.76, 0.88);
    vec3 nightLight = vec3(0.42, 0.44, 0.62);
    vec3 nightShadow = vec3(0.17, 0.17, 0.30);

    vec3 light = mix(dayLight, nightLight, uMixRatio);
    vec3 shadow = mix(dayShadow, nightShadow, uMixRatio);
    vec3 color = mix(shadow, light, vShade);
    color = mix(color, vec3(dot(color, vec3(0.33))) * 0.8, uGloom);

    gl_FragColor = vec4(color, 1.0);
}
