// Dims walkers for night like the baked island; glowing parts (bot eyes) keep their colour.

uniform float uMixRatio;

varying vec3 vColor;
varying float vLight;
varying float vGlow;

void main()
{
    vec3 lit = vColor * vLight;
    vec3 night = lit * vec3(0.35, 0.37, 0.55);
    gl_FragColor = vec4(mix(mix(lit, night, uMixRatio), vColor, vGlow), 1.0);
}
