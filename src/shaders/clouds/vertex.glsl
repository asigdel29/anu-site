// Drifting clouds. Each instance is one puff; puffs of a cloud share aCloud. Clouds travel
// along the wind on lanes that never cross the island, wrap around the field, bob and breathe.
// All motion is here, so the CPU only updates uniforms.

attribute vec4 aCloud; // x: start along the wind, y: lane offset, z: height, w: seed
attribute vec4 aPuff;  // xyz: offset inside the cloud, w: puff radius

uniform float uTime;
uniform vec2 uWind;     // unit wind direction in the ground plane (x, z)
uniform float uSpeed;   // metres per second
uniform float uField;   // half length of the drift lane

varying float vShade;

void main()
{
    vec3 across = vec3(-uWind.y, 0.0, uWind.x);
    vec3 along = vec3(uWind.x, 0.0, uWind.y);

    float travel = mod(aCloud.x + uTime * uSpeed * (0.8 + aCloud.w * 0.4) + uField, 2.0 * uField) - uField;
    // Grow in and out near the lane ends, so the wrap-around is never seen.
    float edge = smoothstep(uField, uField - 10.0, abs(travel));
    float breathe = 1.0 + 0.08 * sin(uTime * 0.5 + aCloud.w * 31.0 + aPuff.x);
    float radius = aPuff.w * edge * breathe;

    vec3 center = along * travel + across * aCloud.y;
    center.y = aCloud.z + sin(uTime * 0.2 + aCloud.w * 12.0) * 0.4;
    center += along * aPuff.x + across * aPuff.z + vec3(0.0, aPuff.y, 0.0);

    vec4 viewPosition = viewMatrix * vec4(center + position * radius, 1.0);
    // Shrink puffs that come close to the camera instead of flying through it.
    viewPosition.xyz = mix(viewMatrix * vec4(center, 1.0), viewPosition, smoothstep(4.0, 10.0, -viewPosition.z)).xyz;
    gl_Position = projectionMatrix * viewPosition;

    // Soft top light with a darker belly, like the baked island.
    vShade = 0.55 + 0.45 * smoothstep(-0.6, 0.9, normal.y);
}
