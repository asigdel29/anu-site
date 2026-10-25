// Facades in a sunny stylized look: rich brick, warm stone and teal glass in soft cel light (a warm
// key and a cool blue-purple shade), a gentle gradient up each building, bright rims on the
// corners and roof edges, chunky cornices, and windows with a sky reflection by day and a warm
// glow by night, hazed toward the sky. Colours are sRGB, like the other scene shaders.

uniform float uMixRatio;
uniform float uTime;
uniform vec3 uPalette[16];

varying vec3 vFacade;
varying vec4 vRoof;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vShape;
varying vec4 vLook;

// Window cell size in metres, then the glass part of each cell (x from, x to, y from, y to),
// per style: punched stone, glass curtain wall, ribbon bands, art deco piers, square grid.
const vec2 CELL[5] = vec2[5](vec2(0.42, 0.36), vec2(0.3, 0.36), vec2(0.42, 0.36), vec2(0.46, 0.36), vec2(0.5, 0.5));
const vec4 PANE[5] = vec4[5](vec4(0.26, 0.74, 0.26, 0.82), vec4(0.06, 0.94, 0.08, 0.96),
                             vec4(0.0, 1.0, 0.36, 0.86), vec4(0.2, 0.64, 0.12, 0.96), vec4(0.14, 0.86, 0.14, 0.86));
const int GLASS = 1;
// Cornice depth below each roof line, in metres.
const float CORNICE = 0.16;

void main()
{
    int style = int(vLook.x + 0.5);
    vec3 normal = normalize(vNormal);
    vec3 toCamera = normalize(cameraPosition - vWorld);
    float wall = 1.0 - step(0.5, abs(normal.y));
    float crown = step(0.5, vLook.w) * step(vLook.w, 1.5);
    float bare = step(1.5, vLook.w);
    float top = vShape.x + vShape.y;

    // Trims (copper, steel, gold, white) keep their exact colour; other materials vary a little
    // from building to building. Roofs are warm gravel, slate or the facade colour, with a pale
    // parapet along the edge.
    float trim = step(7.5, vLook.y) * step(vLook.y, 11.5);
    vec3 base = uPalette[int(vLook.y + 0.5)] * mix(0.9 + 0.2 * fract(vShape.w * 13.7), 1.0, trim);
    float roofKind = fract(vShape.w * 5.3);
    vec3 roofing = roofKind < 0.35 ? vec3(0.4, 0.45, 0.58)
        : roofKind < 0.6 ? vec3(0.7, 0.62, 0.52)
        : roofKind < 0.8 ? vec3(0.28, 0.34, 0.4)
        : base * 0.8;
    float roofEdge = min(min(vRoof.x, vRoof.z - vRoof.x), min(vRoof.y, vRoof.w - vRoof.y));
    roofing = mix(roofing, vec3(0.98, 0.92, 0.8), 1.0 - smoothstep(0.1, 0.1 + 1.5 * fwidth(roofEdge), roofEdge));
    vec3 material = mix(base, roofing, (1.0 - wall) * (1.0 - trim));

    // A chunky cornice along the top of each wall, with a shadow line under it; copper and gold
    // roofs have none.
    float metal = step(abs(vLook.y - 8.0), 0.5) + step(abs(vLook.y - 10.0), 0.5);
    float belowTop = top - vFacade.y;
    float pixel = max(fwidth(vFacade.y), 1e-4);
    float ledge = wall * (1.0 - bare) * (1.0 - metal);
    float cornice = ledge * clamp((CORNICE - belowTop) / pixel + 0.5, 0.0, 1.0);
    float corniceShadow = ledge * clamp((CORNICE + 0.07 - belowTop) / pixel + 0.5, 0.0, 1.0) - cornice;
    material = mix(material, mix(material, vec3(1.0, 0.93, 0.78), 0.55), cornice) * (1.0 - 0.35 * corniceShadow);

    vec2 grid = vFacade.xy / CELL[style];
    vec2 width = fwidth(grid);
    vec4 pane = PANE[style];
    // Crowns, spires, rooftop boxes, copper and gold roofs, and cornices have no windows.
    float window = wall * (1.0 - crown - bare) * (1.0 - metal) * (1.0 - cornice - corniceShadow)
        * filteredPulse(grid.x, width.x, pane.x, pane.y) * filteredPulse(grid.y, width.y, pane.z, pane.w);

    // Each window has its own on/off rhythm; far away, where a pixel spans many windows,
    // the average takes over so nothing sparkles.
    float face = dot(floor(normal.xz * 2.0 + 0.5), vec2(5.0, 17.0));
    vec2 cell = floor(grid) + vec2(face, vShape.w * 311.0);
    float occupancy = 0.2 + 0.3 * fract(vShape.w * 7.0);
    float flip = floor(uTime / 23.0 + hash(cell) * 40.0);
    float litCell = step(1.0 - occupancy, hash(cell + flip * 0.37));
    float detail = 1.0 - smoothstep(0.35, 1.0, max(width.x, width.y));
    float lit = mix(occupancy * 0.8, litCell, detail);
    // Where the pixel falls inside its pane: 0 at the bottom left, 1 at the top right.
    vec2 inPane = clamp((fract(grid) - pane.xz) / (pane.yw - pane.xz), 0.0, 1.0);
    float paneRise = mix(0.5, inPane.y, detail);

    // Soft cel light: a warm key on the faces toward the sun, a cool blue-purple shade on the rest,
    // roofs a touch brighter, darker toward the street and brighter toward the top.
    float sunSide = smoothstep(-0.02, 0.22, dot(normal, SUN));
    vec3 light = mix(SHADE, SUN_COLOR, sunSide) * (1.0 + 0.1 * normal.y);
    float rise = clamp(vFacade.y / max(top, 1.0), 0.0, 1.0);
    float gradient = mix(0.84, 1.08, rise) * mix(0.72, 1.0, smoothstep(0.0, 3.0, vFacade.y));

    // Glass: a deep teal tint low in each pane, the bright sky toward its top and at grazing angles,
    // and a diagonal glint across some panes. Glass towers also brighten toward their tops.
    vec3 sky = mix(uSky, vec3(1.0), 0.25);
    float fresnel = pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
    vec3 tint = style == GLASS ? base : vec3(0.12, 0.33, 0.5);
    float reflection = 0.1 + 0.5 * paneRise * paneRise + 0.3 * fresnel + (style == GLASS ? 0.2 * rise : 0.0);
    float glint = (1.0 - smoothstep(0.1, 0.3, max(width.x, width.y))) * step(0.55, hash(cell + 7.0)) * (1.0 - smoothstep(0.05, 0.11, abs(inPane.x - inPane.y + 0.25)));
    vec3 glass = mix(tint, sky, min(reflection, 0.9)) * mix(0.8, 1.0, sunSide) + 0.3 * glint;
    vec3 day = mix(material * light, glass, window) * gradient;

    // Rims: a bright line down each wall corner, warm on the sunny side and cool in the shade,
    // fading out far away where whole buildings are only a few pixels wide.
    float edge = min(vFacade.x, vFacade.z - vFacade.x);
    float edgePixel = fwidth(edge);
    float rim = wall * (1.0 - smoothstep(0.0, max(0.12, 1.5 * edgePixel), edge)) * (1.0 - smoothstep(0.4, 0.9, edgePixel));
    day = mix(day, mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.95, 0.82), sunSide), rim * 0.45);

    // Night: deep blue-purple facades, warm street light on the lowest floors, windows glowing
    // warm yellow and orange (offices burn more cool white), and floodlit crowns.
    float pick = hash(cell * 1.7);
    float cool = style == GLASS ? 0.35 : 0.1;
    vec3 lampColor = pick < cool ? vec3(0.72, 0.87, 1.0) : pick < cool + 0.3 ? vec3(1.0, 0.6, 0.28) : vec3(1.0, 0.8, 0.42);
    vec3 lamp = mix(vec3(1.0, 0.76, 0.42), lampColor, detail) * (0.85 + 0.3 * (1.0 - paneRise));
    vec3 nightWall = material * vec3(0.1, 0.1, 0.17) + vec3(0.05, 0.045, 0.13);
    nightWall += material * vec3(0.6, 0.35, 0.15) * wall * (1.0 - smoothstep(0.0, 2.5, vFacade.y));
    vec3 nightWindow = mix(vec3(0.06, 0.08, 0.2), lamp * (0.8 + 0.2 * hash(cell + 3.1)), lit);
    vec3 night = mix(nightWall, nightWindow, window) + vec3(0.15, 0.17, 0.35) * rim;
    night = mix(night, base * 1.1 + vec3(0.15, 0.12, 0.05) * smoothstep(0.0, 3.0, vFacade.y - vShape.x), crown);

    vec3 color = mix(day, night, uMixRatio);
    // Lit windows and crowns shine through some of the haze at night.
    float glow = (window * lit + crown) * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.5 * glow)), 1.0);
}
