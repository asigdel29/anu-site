// Places one low-poly crown per park tree from its instance data.

attribute vec4 aTree; // x, z, crown radius, colour index

uniform float uGround;

varying vec3 vWorld;
varying float vColor;

void main()
{
    vec3 crown = position * vec3(aTree.z, aTree.z * 0.8, aTree.z);
    vec4 world = modelMatrix * vec4(aTree.x + crown.x, uGround + aTree.z * 0.9 + crown.y, aTree.y + crown.z, 1.0);
    vWorld = world.xyz;
    vColor = aTree.w;
    gl_Position = projectionMatrix * viewMatrix * world;
}
