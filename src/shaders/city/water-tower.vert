// Places one rooftop water tower per instance: steel legs, a wooden tank and a conical roof,
// sized and turned by its own angle so the towers do not all line up.

attribute vec4 aTower; // x, z, roof height above the street, size
attribute float aPart; // 0 legs, 1 tank, 2 roof

uniform float uGround;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPart;
varying float vHeight; // metres above the roof at size 1

void main()
{
    float angle = fract(aTower.x * 0.37 + aTower.y * 0.11) * 6.283;
    mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
    vec3 local = position * aTower.w;
    local.xz = turn * local.xz;
    vec4 world = modelMatrix * vec4(aTower.x + local.x, uGround + aTower.z + local.y, aTower.y + local.z, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * vec3((turn * normal.xz).x, normal.y, (turn * normal.xz).y));
    vPart = aPart;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * world;
}
