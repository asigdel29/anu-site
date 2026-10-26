// Places one stylized tree per park tree from its instance data. The canopy sways gently in the
// wind, each tree in its own rhythm; the trunk stays put.

attribute vec4 aTree;   // x, z, crown radius, colour index
attribute vec2 aCanopy; // height in the canopy (-1 on the trunk), distance out from the core

uniform float uGround;
uniform float uTime;
uniform float uMotion; // 0 when the visitor asks for less motion

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vCanopy;
varying float vColor;
varying float vTone; // 0..1 per tree, for small colour differences

void main()
{
    float tone = fract(sin(dot(aTree.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 local = position * aTree.z;
    float phase = tone * 6.283;
    float sway = uMotion * max(aCanopy.x, 0.0) * aTree.z * 0.05;
    local.xz += sway * vec2(sin(uTime * 1.2 + phase), cos(uTime * 0.9 + phase * 1.3));
    vec4 world = modelMatrix * vec4(aTree.x + local.x, uGround + local.y, aTree.y + local.z, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vCanopy = aCanopy;
    vColor = aTree.w;
    vTone = tone;
    gl_Position = projectionMatrix * viewMatrix * world;
}
