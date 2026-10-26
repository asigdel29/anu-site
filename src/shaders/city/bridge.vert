// The East River bridges: plain geometry in city space, so this only passes on each point's
// part, paint and cable data, and its height above the street.

attribute float aPart; // 0 deck, 1 stone tower, 2 steel tower, 3 cable curtain
attribute vec3 aPaint; // sRGB colour
attribute vec3 aCable; // curtains: metres along the bridge, metres below the cable, diagonal web

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vPaint;
varying vec3 vCable;
varying vec2 vFace;   // where the point sits on its box face, 0..1 across and up
varying float vPart;
varying float vHeight;

void main()
{
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPaint = aPaint;
    vCable = aCable;
    vFace = uv;
    vPart = aPart;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * world;
}
