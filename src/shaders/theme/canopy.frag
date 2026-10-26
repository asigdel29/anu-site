// Blends the canopy's baked day and night vertex colours by uMixRatio (0 = day, 1 = night).
// The colours are stored in sRGB; the blend runs in linear light, like the atlas shader's.

uniform float uMixRatio;

varying vec3 vDayColor;
varying vec3 vNightColor;

void main() {
    vec3 color = mix(pow(vDayColor, vec3(2.2)), pow(vNightColor, vec3(2.2)), uMixRatio);
    gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
