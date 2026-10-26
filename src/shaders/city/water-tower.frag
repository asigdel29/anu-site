// Rooftop water towers in the stylized city light: warm cedar tanks bound by dark steel hoops, a
// dark conical roof and steel legs, a warm rim on the sunny side, and dark silhouettes at night.

uniform float uMixRatio;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPart;
varying float vHeight;

// How many hoops bind the tank. TANK (its height range above the roof at size 1) comes from
// src/skyline.js as a define.
const float HOOPS = 3.0;

void main()
{
    // The legs are single strips: their back faces light as if they faced the camera.
    vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);
    vec3 toCamera = normalize(cameraPosition - vWorld);
    float hoopCoord = (vHeight - TANK.x) / (TANK.y - TANK.x) * HOOPS + 0.5;
    float hoop = step(0.5, vPart) * step(vPart, 1.5) * filteredPulse(hoopCoord, fwidth(hoopCoord), 0.0, 0.18);
    vec3 base = vPart < 0.5 ? vec3(0.22, 0.25, 0.32)
        : vPart < 1.5 ? mix(vec3(0.72, 0.46, 0.26), vec3(0.26, 0.22, 0.24), hoop)
        : vec3(0.32, 0.28, 0.34);
    float rim = pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
    // Only the theme in view is shaded; both blend while the theme changes.
    vec3 color = vec3(0.0);
    if (uMixRatio < 1.0)
    {
        float sunSide = smoothstep(-0.05, 0.3, dot(normal, SUN));
        // Wood is lighter toward the top of the tank, where it sees more sky.
        float rise = mix(1.0, mix(0.82, 1.08, clamp((vHeight - TANK.x) / (TANK.y - TANK.x), 0.0, 1.0)), step(0.5, vPart) * step(vPart, 1.5));
        color = base * mix(SHADE, SUN_COLOR, sunSide) * rise + vec3(1.0, 0.92, 0.75) * 0.25 * rim * sunSide;
    }
    if (uMixRatio > 0.0)
    {
        vec3 night = base * vec3(0.1, 0.1, 0.17) + vec3(0.04, 0.04, 0.1) + vec3(0.1, 0.12, 0.28) * rim;
        color = mix(color, night, uMixRatio);
    }
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld)), 1.0);
}
