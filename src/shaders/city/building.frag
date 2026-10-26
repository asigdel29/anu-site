// Facades in a sunny stylized look: rich brick, warm stone and teal glass in soft cel light (a warm
// key and a cool blue-purple shade), a gentle gradient up each building, bright rims on the
// corners and roof edges, chunky cornices, and windows with a sky reflection by day and a warm
// glow by night, hazed toward the sky. Colours are sRGB, like the other scene shaders.

uniform float uMixRatio;
uniform float uTime;

varying vec3 vFacade;
varying vec4 vRoof;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vShape;
varying vec3 vBase;
varying vec3 vRoofing;
varying vec2 vCellSize;
varying vec4 vPane;
varying vec4 vKind;

// Cornice depth below each roof line, in metres.
const float CORNICE = 0.16;
// Storefront height above the street, and the width of one shop, in metres.
const float SHOP = 0.42;
const float SHOP_WIDTH = 0.9;
// Awning colours: red, green, navy and yellow.
const vec3 AWNING[4] = vec3[4](vec3(0.86, 0.24, 0.2), vec3(0.18, 0.6, 0.34), vec3(0.18, 0.3, 0.62), vec3(0.98, 0.76, 0.2));

void main()
{
    vec3 normal = normalize(vNormal);
    float wall = 1.0 - step(0.5, abs(normal.y));
    float top = vShape.y;

    // Roofs get a pale parapet along the edge.
    float roofEdge = min(min(vRoof.x, vRoof.z - vRoof.x), min(vRoof.y, vRoof.w - vRoof.y));
    float parapet = vKind.z * (1.0 - smoothstep(0.1, 0.1 + 1.5 * fwidth(roofEdge), roofEdge));
    vec3 material = wall > 0.5 ? vBase : mix(vRoofing, vec3(0.98, 0.92, 0.8), parapet);

    // A chunky cornice along the top of each wall, with a shadow line under it.
    float belowTop = top - vFacade.y;
    float pixel = max(fwidth(vFacade.y), 1e-4);
    float ledge = wall * vKind.z;
    float cornice = ledge * clamp((CORNICE - belowTop) / pixel + 0.5, 0.0, 1.0);
    float corniceShadow = ledge * clamp((CORNICE + 0.07 - belowTop) / pixel + 0.5, 0.0, 1.0) - cornice;
    material = mix(material, mix(material, vec3(1.0, 0.93, 0.78), 0.55), cornice) * (1.0 - 0.35 * corniceShadow);

    // Storefronts on every building that stands on the street: shop windows between stone piers
    // under a coloured awning, one shop every SHOP_WIDTH metres.
    float street = wall * vKind.z * (1.0 - step(0.01, vShape.x));
    float shops = street * clamp((SHOP - vFacade.y) / pixel + 0.5, 0.0, 1.0);
    float awning = street * clamp((SHOP + 0.1 - vFacade.y) / pixel + 0.5, 0.0, 1.0) - shops;
    float shopCell = vFacade.x / SHOP_WIDTH;
    float shopGlass = shops * filteredPulse(shopCell, fwidth(shopCell), 0.12, 0.88) * clamp((SHOP - 0.06 - vFacade.y) / pixel + 0.5, 0.0, 1.0);
    vec3 awningColor = awning > 0.0 ? AWNING[int(hash(vec2(floor(shopCell), vShape.w * 97.0)) * 3.99)] : vec3(0.0);

    vec2 grid = vFacade.xy / vCellSize;
    vec2 width = fwidth(grid);
    float window = wall * vKind.y * (1.0 - cornice - corniceShadow) * (1.0 - shops - awning)
        * filteredPulse(grid.x, width.x, vPane.x, vPane.y) * filteredPulse(grid.y, width.y, vPane.z, vPane.w);
    // Near windows show their own pattern; far away, where a pixel spans many windows, the average
    // takes over so nothing sparkles (and no window is worked out).
    float detail = 1.0 - smoothstep(0.35, 1.0, max(width.x, width.y));
    float glintDetail = 1.0 - smoothstep(0.1, 0.3, max(width.x, width.y));
    // Rims: a bright line down each wall corner, fading out far away where whole buildings are
    // only a few pixels wide.
    float edge = min(vFacade.x, vFacade.z - vFacade.x);
    float edgePixel = fwidth(edge);
    float rim = wall * (1.0 - smoothstep(0.0, max(0.12, 1.5 * edgePixel), edge)) * (1.0 - smoothstep(0.4, 0.9, edgePixel));
    // Where the pixel falls inside its pane (0 at the bottom left, 1 at the top right), and the
    // window's own id, so its glint and its lamp stay with it.
    vec2 inPane = clamp((fract(grid) - vPane.xz) / (vPane.yw - vPane.xz), 0.0, 1.0);
    float face = dot(floor(normal.xz * 2.0 + 0.5), vec2(5.0, 17.0));
    vec2 cell = floor(grid) + vec2(face, vShape.w * 311.0);

    // Only the theme in view is shaded (the branch is the same for every pixel), so a frame costs
    // one theme's work; both blend while the theme changes.
    vec3 color = vec3(0.0);
    float glow = 0.0;
    if (uMixRatio < 1.0)
    {
        // Soft cel light: a warm key on the faces toward the sun, a cool blue-purple shade on the
        // rest, roofs a touch brighter, darker toward the street and brighter toward the top.
        float sunSide = smoothstep(-0.02, 0.22, dot(normal, SUN));
        vec3 light = mix(SHADE, SUN_COLOR, sunSide) * (1.0 + 0.1 * normal.y);
        float rise = clamp(vFacade.y / max(top, 1.0), 0.0, 1.0);
        float gradient = mix(0.84, 1.08, rise) * mix(0.72, 1.0, smoothstep(0.0, 3.0, vFacade.y));

        // Glass: a deep teal tint low in each pane, the bright sky toward its top and at grazing
        // angles, and a diagonal glint across some panes. Glass towers also brighten toward their tops.
        float paneRise = mix(0.5, inPane.y, detail);
        float facing = 1.0 - max(dot(normal, normalize(cameraPosition - vWorld)), 0.0);
        vec3 tint = mix(vec3(0.12, 0.33, 0.5), vBase, vKind.x);
        float reflection = 0.1 + 0.5 * paneRise * paneRise + 0.3 * facing * facing * facing + 0.2 * rise * vKind.x;
        float glint = glintDetail > 0.0 ? glintDetail * step(0.55, hash(cell + 7.0)) * (1.0 - smoothstep(0.05, 0.11, abs(inPane.x - inPane.y + 0.25))) : 0.0;
        vec3 glass = mix(tint, mix(uSky, vec3(1.0), 0.25), min(reflection, 0.9)) * mix(0.8, 1.0, sunSide) + 0.3 * glint;
        vec3 day = mix(material * light, glass, window) * gradient;
        // Shop windows mirror the sky like the windows above; awnings take the sun.
        day = mix(day, mix(vec3(0.1, 0.28, 0.4), mix(uSky, vec3(1.0), 0.25), 0.3 + 0.3 * facing), shopGlass);
        day = mix(day, awningColor * light, awning);
        // The rim is warm on the sunny side and cool in the shade.
        color = mix(day, mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.95, 0.82), sunSide), rim * 0.45);
    }
    if (uMixRatio > 0.0)
    {
        // Each window has its own on/off rhythm and its lamp: warm yellow and orange, and more cool
        // white in offices.
        float lit = vKind.w * 0.8;
        vec3 lamp = vec3(0.9, 0.68, 0.38);
        if (detail > 0.0 && window > 0.0)
        {
            float flip = floor(uTime / 23.0 + hash(cell) * 40.0);
            lit = mix(lit, step(1.0 - vKind.w, hash(cell + flip * 0.37)), detail);
            float pick = hash(cell * 1.7);
            float cool = mix(0.1, 0.35, vKind.x);
            vec3 lampColor = pick < cool ? vec3(0.72, 0.87, 1.0) : pick < cool + 0.3 ? vec3(1.0, 0.6, 0.28) : vec3(1.0, 0.8, 0.42);
            lamp = mix(lamp, lampColor * (0.85 + 0.3 * (1.0 - inPane.y)) * (0.8 + 0.2 * fract(pick * 7.3)), detail);
        }
        // Night: deep blue-purple facades, warm street light on the lowest floors, glowing windows
        // and floodlit crowns.
        vec3 nightWall = material * vec3(0.1, 0.1, 0.17) + vec3(0.05, 0.045, 0.13);
        nightWall += material * vec3(0.6, 0.35, 0.15) * wall * (1.0 - smoothstep(0.0, 2.5, vFacade.y));
        vec3 night = mix(nightWall, mix(vec3(0.06, 0.08, 0.2), lamp, lit), window) + vec3(0.15, 0.17, 0.35) * rim;
        night = mix(night, vBase * 1.1 + vec3(0.15, 0.12, 0.05) * smoothstep(0.0, 3.0, vFacade.y - vShape.x), vShape.z);
        // The shops stay lit late, under awnings caught in their light.
        night = mix(night, vec3(1.0, 0.78, 0.46) * 1.15, shopGlass);
        night = mix(night, awningColor * 0.35 + vec3(0.12, 0.07, 0.03), awning);
        color = mix(color, night, uMixRatio);
        // Lit windows, shops and crowns shine through some of the haze at night.
        glow = (window * lit + shopGlass + vShape.z) * uMixRatio;
    }
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.5 * glow)), 1.0);
}
