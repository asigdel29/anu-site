// Places one unit box per building from its instance data. Taper shrinks the top for
// pointed crowns; slant drops the roof's south edge (Citigroup, Hudson Yards). Passes facade
// and roof coordinates in metres so the fragment shader can draw windows, rims and parapets,
// and works out each building's colours and window pattern here, once per corner instead of
// once per pixel.

attribute vec4 aFootprint; // x, z centre, width (x), depth (z)
attribute vec4 aShape;     // base above the street, height, taper, seed
attribute vec4 aLook;      // facade style, palette index, roof slant in metres, night light

uniform float uGround;
uniform vec3 uPalette[16];

varying vec3 vFacade;   // metres across the face, metres up, face width in metres
varying vec4 vRoof;     // metres from the roof's west and north edges, roof width and depth
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vShape;    // base above the street, top, 1 on a floodlit crown, seed
varying vec3 vBase;     // facade colour
varying vec3 vRoofing;  // roof colour
varying vec2 vCellSize; // window cell size in metres
varying vec4 vPane;     // the glass part of each cell: x from, x to, y from, y to
varying vec4 vKind;     // 1 on glass towers, 1 where windows go, 1 where a cornice goes, night occupancy

// Window cell size in metres, then the glass part of each cell, per style: punched stone, glass
// curtain wall, ribbon bands, art deco piers, square grid.
const vec2 CELL[5] = vec2[5](vec2(0.42, 0.36), vec2(0.3, 0.36), vec2(0.42, 0.36), vec2(0.46, 0.36), vec2(0.5, 0.5));
const vec4 PANE[5] = vec4[5](vec4(0.26, 0.74, 0.26, 0.82), vec4(0.06, 0.94, 0.08, 0.96),
                             vec4(0.0, 1.0, 0.36, 0.86), vec4(0.2, 0.64, 0.12, 0.96), vec4(0.14, 0.86, 0.14, 0.86));

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

    // Trims (copper, steel, gold, white) keep their exact colour and roof; other materials vary a
    // little from building to building, and their roofs are slate, gravel, charcoal or the facade
    // colour. Crowns, spires, rooftop boxes and copper or gold roofs have no windows or cornice.
    float seed = aShape.w;
    float trim = step(7.5, aLook.y) * step(aLook.y, 11.5);
    float metal = step(abs(aLook.y - 8.0), 0.5) + step(abs(aLook.y - 10.0), 0.5);
    float crown = step(0.5, aLook.w) * step(aLook.w, 1.5);
    float bare = step(1.5, aLook.w);
    vBase = uPalette[int(aLook.y + 0.5)] * mix(0.9 + 0.2 * fract(seed * 13.7), 1.0, trim);
    float roofKind = fract(seed * 5.3);
    vec3 roofing = roofKind < 0.35 ? vec3(0.4, 0.45, 0.58)
        : roofKind < 0.6 ? vec3(0.7, 0.62, 0.52)
        : roofKind < 0.8 ? vec3(0.28, 0.34, 0.4)
        : vBase * 0.8;
    vRoofing = mix(roofing, vBase, trim);
    int style = int(aLook.x + 0.5);
    vCellSize = CELL[style];
    vPane = PANE[style];
    vKind = vec4(style == 1 ? 1.0 : 0.0, (1.0 - crown - bare) * (1.0 - metal), (1.0 - bare) * (1.0 - metal), 0.2 + 0.3 * fract(seed * 7.0));
    vShape = vec4(aShape.x, aShape.x + aShape.y, crown, seed);
    gl_Position = projectionMatrix * viewMatrix * world;
}
