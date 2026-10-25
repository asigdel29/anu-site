// Colours the data skyline (R shade, G window, B tree, A coverage) for day or night,
// lights and twinkles windows after dark, and hazes everything toward the live sky.

uniform sampler2D uSkyline;
uniform float uMixRatio;
uniform float uTime;
uniform vec3 uSky;
uniform float uHaze;
uniform float uTextureStart; // ring height fraction where the city starts; below is park ground

varying vec2 vUv;

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main()
{
    vec2 uv = vec2(vUv.x, (vUv.y - uTextureStart) / (1.0 - uTextureStart));
    vec3 dayTree = vec3(0.38, 0.62, 0.42);
    vec3 nightTree = vec3(0.08, 0.13, 0.14);
    if (uv.y < 0.0) {
        // Park ground under the trees, sinking into the haze so the ring has no hard edge.
        vec3 ground = mix(dayTree, nightTree, uMixRatio) * 0.85;
        gl_FragColor = vec4(mix(ground, uSky, mix(uHaze, 1.0, smoothstep(0.0, -0.5, uv.y))), 1.0);
        return;
    }
    vec4 data = texture2D(uSkyline, uv);
    if (data.a < 0.5) discard;

    vec3 dayBuilding = mix(vec3(0.55, 0.60, 0.72), vec3(0.80, 0.83, 0.90), data.r);
    vec3 nightBuilding = mix(vec3(0.10, 0.10, 0.20), vec3(0.20, 0.21, 0.36), data.r);
    vec3 color = mix(dayBuilding, nightBuilding, uMixRatio);

    if (data.g > 0.0) {
        // Each window gets its own slow on/off rhythm at night.
        vec2 cell = floor(vUv * vec2(2048.0, 128.0));
        float lit = step(0.45, hash(cell + floor(uTime / 9.0 + hash(cell) * 9.0)));
        vec3 dayWindow = color * 0.85 + vec3(0.04, 0.06, 0.1);
        vec3 nightWindow = mix(color, vec3(1.0, 0.78, 0.42) * (0.6 + data.g * 0.4), lit);
        color = mix(dayWindow, nightWindow, uMixRatio);
    }
    if (data.b > 0.5) {
        color = mix(mix(dayTree, vec3(0.95, 0.55, 0.62), step(0.6, data.r)) * (0.8 + data.r * 0.3),
                    nightTree, uMixRatio);
    }

    gl_FragColor = vec4(mix(color, uSky, uHaze), 1.0);
}
