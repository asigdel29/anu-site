// Drives each car along its lane from uTime: the lane's start, length and heading, the car's
// speed and phase. A car grows in at the start of its lane and shrinks out at the end, so the
// jump back to the start never shows. With less motion asked for, the cars stand still.

attribute vec4 aLane; // start x, z, length in metres, heading (0 south, 1 north, 2 east, 3 west)
attribute vec4 aCar;  // speed in metres a second, phase (0..1 along the lane), colour index, 0

uniform float uGround;
uniform float uTime;
uniform float uMotion;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal; // position in the car's own frame: x forward, y up, z to its right
varying float vColor;

void main()
{
    float along = fract(aCar.y + uMotion * uTime * aCar.x / aLane.z);
    float ends = 1.5 / aLane.z;
    float grow = smoothstep(0.0, ends, along) * smoothstep(1.0, 1.0 - ends, along);
    int heading = int(aLane.w + 0.5);
    vec2 forward = heading == 0 ? vec2(0.0, 1.0) : heading == 1 ? vec2(0.0, -1.0) : heading == 2 ? vec2(1.0, 0.0) : vec2(-1.0, 0.0);
    vec2 left = vec2(forward.y, -forward.x);
    vec2 centre = aLane.xy + forward * along * aLane.z;
    vec3 local = position * grow;
    vec2 flat2 = centre + forward * local.x - left * local.z;
    vec4 world = modelMatrix * vec4(flat2.x, uGround + local.y, flat2.y, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * vec3(forward.x * normal.x - left.x * normal.z, normal.y, forward.y * normal.x - left.y * normal.z));
    vLocal = position;
    vColor = aCar.z;
    gl_Position = projectionMatrix * viewMatrix * world;
}
