// Facades in a toy-model look: soft clay light by day with light tops and rounded-looking edges,
// a window grid for each style, candy-coloured windows that come and go by night, floodlit crowns,
// and haze toward the sky. Colours are sRGB, like the other scene shaders.

uniform float uMixRatio;
uniform float uTime;
uniform vec3 uPalette[12];

varying vec3 vFacade;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vShape;
varying vec4 vLook;

// Window cell size in metres, then the lit part of each cell (x from, x to, y from, y to),
// per style: punched stone, glass curtain wall, ribbon bands, art deco piers, square grid.
const vec2 CELL[5] = vec2[5](vec2(0.42, 0.36), vec2(0.3, 0.36), vec2(0.42, 0.36), vec2(0.46, 0.36), vec2(0.5, 0.5));
const vec4 PANE[5] = vec4[5](vec4(0.28, 0.72, 0.3, 0.8), vec4(0.05, 0.95, 0.08, 0.96),
                             vec4(0.0, 1.0, 0.38, 0.86), vec4(0.22, 0.62, 0.12, 0.96), vec4(0.14, 0.86, 0.14, 0.86));
const vec3 SUN = vec3(0.45, 0.8, 0.4);
const vec3 MOON = vec3(-0.5, 0.7, -0.3);

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main()
{
    int style = int(vLook.x + 0.5);
    vec3 base = uPalette[int(vLook.y + 0.5)];
    vec3 normal = normalize(vNormal);
    float wall = 1.0 - step(0.5, abs(normal.y));
    float crown = step(0.5, vLook.w) * step(vLook.w, 1.5);
    float bare = step(1.5, vLook.w);

    vec2 grid = vFacade.xy / CELL[style];
    vec2 width = fwidth(grid);
    vec4 pane = PANE[style];
    // Crowns, spires and rooftop boxes have no windows.
    float window = wall * (1.0 - crown - bare) * filteredPulse(grid.x, width.x, pane.x, pane.y)
        * filteredPulse(grid.y, width.y, pane.z, pane.w);

    // Each window has its own on/off rhythm; far away, where a pixel spans many windows,
    // the average takes over so nothing sparkles.
    float face = dot(floor(normal.xz * 2.0 + 0.5), vec2(5.0, 17.0));
    vec2 cell = floor(grid) + vec2(face, vShape.w * 311.0);
    float occupancy = 0.12 + 0.26 * fract(vShape.w * 7.0);
    float flip = floor(uTime / 23.0 + hash(cell) * 40.0);
    float litCell = step(1.0 - occupancy, hash(cell + flip * 0.37));
    float detail = 1.0 - smoothstep(0.35, 1.0, max(width.x, width.y));
    float lit = mix(occupancy * 0.8, litCell, detail);
    // Candy lamps: mostly warm yellow, then peach, then pink. Far away, where a pixel spans many
    // windows, their average takes over so the colours do not sparkle.
    float pick = hash(cell * 1.7);
    vec3 candy = pick < 0.6 ? vec3(1.0, 0.84, 0.38)
        : pick < 0.85 ? vec3(1.0, 0.64, 0.45)
        : vec3(1.0, 0.58, 0.76);
    vec3 lamp = mix(vec3(1.0, 0.77, 0.45), candy, detail);

    // Rounded edges: a soft light band along each wall's corners and top, at least a pixel and a
    // half wide, faded out far away where whole buildings are only a few pixels wide.
    float edge = min(min(vFacade.x, vFacade.z - vFacade.x), vShape.x + vShape.y - vFacade.y);
    float edgePixel = fwidth(edge);
    float bevel = wall * (1.0 - smoothstep(0.0, max(0.25, 1.5 * edgePixel), edge))
        * (1.0 - smoothstep(0.4, 0.9, edgePixel));

    // Day: soft even light like a clay model. Tops are the lightest face, the walls shade only
    // a little, the windows are a pale glassy tint and the bases darken just a touch.
    float sun = 0.74 + 0.3 * max(dot(normal, normalize(SUN)), 0.0);
    vec3 dayWall = base * mix(sun, 1.08, 1.0 - wall);
    vec3 dayWindow = mix(base, vec3(0.93, 0.98, 1.0), 0.45);
    vec3 day = mix(dayWall, dayWindow, window * 0.35);
    day *= mix(0.86, 1.0, smoothstep(0.0, 5.0, vFacade.y));
    day = mix(day, vec3(1.0), 0.32 * bevel);

    // Night: a toy night of indigo facades with a little moonlight, and candy-lit windows.
    vec3 nightWall = base * 0.16 + vec3(0.07, 0.05, 0.17) + 0.05 * max(dot(normal, normalize(MOON)), 0.0);
    vec3 nightWindow = mix(vec3(0.1, 0.08, 0.22), lamp * (0.8 + 0.2 * hash(cell + 3.1)), lit);
    vec3 night = mix(nightWall, nightWindow, window);
    night += vec3(0.08, 0.06, 0.16) * bevel;
    // Floodlit crowns glow in their own colour, brightest at the top.
    night = mix(night, base * 1.25 + 0.15 * smoothstep(0.0, 3.0, vFacade.y - vShape.x), crown);

    vec3 color = mix(day, night, uMixRatio);
    // Lit windows and crowns shine through some of the haze at night.
    float glow = (window * lit + crown) * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.5 * glow)), 1.0);
}
