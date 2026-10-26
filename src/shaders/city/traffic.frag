// Cars in the stylized city light: taxi yellow and bright paints, a dark window band round the
// cabin, the same warm sun and cool shade as the buildings, and by night warm headlights at the
// front and red tail lights at the back. CAR_SIZE (length, height, width) comes from
// src/skyline.js as a define.

uniform float uMixRatio;
uniform vec3 uCarPalette[7];

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying float vColor;

void main()
{
    vec3 normal = normalize(vNormal);
    vec3 paint = uCarPalette[int(vColor + 0.5)];
    // The cabin's windows: the upper part of each side, short of the bonnet and the boot.
    float side = 1.0 - step(0.5, abs(normal.y));
    float cabin = side * step(CAR_SIZE.y * 0.55, vLocal.y) * step(abs(vLocal.x + 0.03), CAR_SIZE.x * 0.3);
    vec3 base = mix(paint, vec3(0.12, 0.17, 0.26), cabin);
    // The ends of the car, where its lights are: 1 at the front, -1 at the back. They cover the
    // last bit of the roof too, so the lights read from the cameras high above.
    float end = step(CAR_SIZE.x * 0.38, vLocal.x) - step(vLocal.x, -CAR_SIZE.x * 0.38);
    // Only the theme in view is shaded; both blend while the theme changes.
    vec3 color = vec3(0.0);
    float glow = 0.0;
    if (uMixRatio < 1.0)
    {
        float sunSide = smoothstep(-0.05, 0.3, dot(normal, SUN));
        color = base * mix(SHADE, SUN_COLOR, sunSide) * (1.0 + 0.15 * normal.y);
    }
    if (uMixRatio > 0.0)
    {
        vec3 night = base * vec3(0.12, 0.12, 0.2) + vec3(0.03, 0.03, 0.08);
        vec3 lamp = end > 0.5 ? vec3(1.0, 0.93, 0.72) : vec3(1.0, 0.12, 0.08);
        float lit = abs(end);
        night = mix(night, lamp * 1.4, lit);
        color = mix(color, night, uMixRatio);
        glow = lit * uMixRatio;
    }
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.6 * glow)), 1.0);
}
