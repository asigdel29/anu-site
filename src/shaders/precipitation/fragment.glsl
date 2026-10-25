// Thin streaks for rain (pale cyan by day, lilac by night), soft white flakes for snow.

uniform float uSnow;
uniform float uMixRatio;

varying float vAlpha;

void main()
{
    vec2 uv = gl_PointCoord - 0.5;
    float streak = (1.0 - smoothstep(0.0, 0.05, abs(uv.x))) * (1.0 - smoothstep(0.3, 0.5, abs(uv.y)));
    float flake = 1.0 - smoothstep(0.15, 0.3, length(uv));
    float shape = mix(streak, flake, uSnow);
    if (shape < 0.02) discard;

    vec3 rain = mix(vec3(0.82, 0.94, 1.0), vec3(0.64, 0.6, 0.92), uMixRatio);
    vec3 color = mix(rain, vec3(1.0), uSnow);
    gl_FragColor = vec4(color, shape * vAlpha * mix(0.55, 0.9, uSnow));
}
