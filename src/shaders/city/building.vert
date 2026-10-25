// Places one unit box per building from its instance data. Taper shrinks the top for
// pointed crowns; slant drops the roof's south edge (Citigroup, Hudson Yards). Passes facade
// and roof coordinates in metres so the fragment shader can draw windows, rims and parapets.

attribute vec4 aFootprint; // x, z centre, width (x), depth (z)
attribute vec4 aShape;     // base above the street, height, taper, seed
attribute vec4 aLook;      // facade style, palette index, roof slant in metres, night light

uniform float uGround;

varying vec3 vFacade;  // metres across the face, metres up, face width in metres
varying vec4 vRoof;    // metres from the roof's west and north edges, roof width and depth
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vShape;
varying vec4 vLook;

void main()
{
    // The geometry is a unit box with its base at y = 0.
    float shrink = 1.0 - aShape.z * position.y;
    vec3 local = vec3(position.x * aFootprint.z * shrink, position.y * aShape.y, position.z * aFootprint.w * shrink);
    local.y -= aLook.z * step(0.999, position.y) * (position.z + 0.5);
    vec4 world = modelMatrix * vec4(aFootprint.x + local.x, uGround + aShape.x + local.y, aFootprint.y + local.z, 1.0);

    // The face width lets the fragment shader find the wall's corners for the rim light.
    bool eastWest = abs(normal.x) > 0.5;
    float faceWidth = eastWest ? aFootprint.w : aFootprint.z;
    float across = ((eastWest ? position.z : position.x) + 0.5) * faceWidth;
    vec2 roofSize = aFootprint.zw * (1.0 - aShape.z);
    vFacade = vec3(across, aShape.x + local.y, faceWidth);
    vRoof = vec4((position.xz + 0.5) * roofSize, roofSize);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vWorld = world.xyz;
    vShape = aShape;
    vLook = aLook;
    gl_Position = projectionMatrix * viewMatrix * world;
}
