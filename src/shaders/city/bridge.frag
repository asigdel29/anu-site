// The East River bridges in the stylized city light: decks, the Brooklyn Bridge's granite towers
// with their two gothic arches, steel towers, and main cables with their suspenders (and the
// Brooklyn Bridge's diagonal web) drawn on the cable curtains, the gaps cut away. By night the
// cables wear a string of lights and the stone towers are floodlit.

uniform float uMixRatio;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vPaint;
varying vec3 vCable;
varying vec2 vFace;
varying float vPart;
varying float vHeight;

// 1 within halfWidth of the nearest multiple of spacing, and never thinner than about a pixel,
// so far cables still show as fine lines.
float wire(float coord, float spacing, float halfWidth)
{
    float pixel = fwidth(coord);
    float width = max(halfWidth, 0.5 * pixel);
    float distance = abs(coord - spacing * floor(coord / spacing + 0.5));
    return 1.0 - smoothstep(width - 0.5 * pixel, width + 0.5 * pixel, distance);
}

void main()
{
    vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);
    float curtain = step(2.5, vPart);
    float stone = step(0.5, vPart) * step(vPart, 1.5);

    // The curtain is the cable band at its top, the suspenders every 0.7 m, and near the Brooklyn
    // Bridge's towers a diagonal web; the rest is cut away.
    float cable = 1.0 - smoothstep(max(0.18, fwidth(vCable.y)), max(0.18, fwidth(vCable.y)) * 1.5, vCable.y);
    float suspenders = wire(vCable.x, 0.7, 0.03);
    float web = vCable.z * max(wire(vCable.x + vHeight, 1.4, 0.03), wire(vCable.x - vHeight, 1.4, 0.03));
    if (curtain > 0.5 && max(cable, max(suspenders, web)) < 0.5) discard;

    // Two tall pointed arches through each face of a granite tower, where the roadway passes.
    vec2 arch = vec2(abs(abs(vFace.x - 0.5) - 0.2) / 0.1, vFace.y);
    float opening = stone * step(arch.x, 1.0) * step(0.45, arch.y) * step(arch.y, 0.78 - 0.08 * arch.x * arch.x);
    vec3 base = mix(vPaint, vPaint * 0.3, opening);
    // The deck's top is an asphalt roadway.
    base = mix(base, vec3(0.17, 0.25, 0.32), step(vPart, 0.5) * step(0.5, normal.y));
    base = mix(base, mix(base, vec3(0.95, 0.92, 0.85), 0.4), curtain * cable);

    // Only the theme in view is shaded; both blend while the theme changes.
    vec3 color = vec3(0.0);
    float glow = 0.0;
    if (uMixRatio < 1.0)
    {
        float sunSide = smoothstep(-0.05, 0.3, dot(normal, SUN));
        color = base * mix(SHADE, SUN_COLOR, sunSide);
    }
    if (uMixRatio > 0.0)
    {
        vec3 night = base * vec3(0.12, 0.12, 0.2) + vec3(0.03, 0.03, 0.08);
        float necklace = curtain * cable * step(fract(vCable.x / 1.2), 0.35);
        float flood = stone * (1.0 - opening) * smoothstep(0.0, 1.0, vFace.y);
        night += vec3(1.0, 0.9, 0.65) * necklace + vPaint * 0.55 * flood;
        color = mix(color, night, uMixRatio);
        glow = max(necklace, flood * 0.5) * uMixRatio;
    }
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.6 * glow)), 1.0);
}
