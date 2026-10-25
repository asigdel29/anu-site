// Blends one baked day atlas with its night twin by uMixRatio (0 = day, 1 = night).

uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform float uMixRatio;

varying vec2 vUv;

void main() {
    vec3 dayColor = texture2D(uDayTexture, vUv).rgb;
    vec3 nightColor = texture2D(uNightTexture, vUv).rgb;
    vec3 finalColor = mix(dayColor, nightColor, uMixRatio);

    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    gl_FragColor = vec4(finalColor, 1.0);
}
