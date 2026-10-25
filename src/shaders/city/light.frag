// A soft red dot that shows only at night and dims in the haze.

uniform float uMixRatio;

varying float vBlink;
varying vec3 vWorld;

void main()
{
    float dot = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
    float alpha = dot * vBlink * uMixRatio * (1.0 - 0.6 * hazeAmount(vWorld));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(1.0, 0.18, 0.12, alpha);
}
