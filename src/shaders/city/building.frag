// Facades: a window grid for each style, sun shading by day, lit windows that come and go
// by night, floodlit crowns, darker bases, and haze toward the sky. Colours are sRGB, like the
// other scene shaders.

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
    float occupancy = 0.18 + 0.34 * fract(vShape.w * 7.0);
    float flip = floor(uTime / 23.0 + hash(cell) * 40.0);
    float litCell = step(1.0 - occupancy, hash(cell + flip * 0.37));
    float detail = 1.0 - smoothstep(0.35, 1.0, max(width.x, width.y));
    float lit = mix(occupancy * 0.8, litCell, detail);
    vec3 lamp = mix(vec3(1.0, 0.78, 0.45), vec3(0.86, 0.92, 1.0), step(0.78, hash(cell * 1.7)));

    // Day: sunlit and shaded faces, glass that reflects the sky, darker toward the street.
    float sun = 0.66 + 0.34 * max(dot(normal, normalize(SUN)), 0.0);
    vec3 dayWall = base * mix(sun, 0.82, 1.0 - wall);
    vec3 dayWindow = mix(base * 0.5, uSky, 0.35 + 0.15 * smoothstep(0.0, 40.0, vFacade.y));
    vec3 day = mix(dayWall, dayWindow, window);
    day *= mix(0.62, 1.0, smoothstep(0.0, 5.0, vFacade.y));

    // Night: dark facades with a little moonlight, warm and cool lit windows.
    vec3 nightWall = base * 0.14 + vec3(0.03, 0.035, 0.08) + 0.04 * max(dot(normal, normalize(MOON)), 0.0);
    vec3 nightWindow = mix(vec3(0.05, 0.06, 0.1), lamp * (0.75 + 0.25 * hash(cell + 3.1)), lit);
    vec3 night = mix(nightWall, nightWindow, window);
    // Floodlit crowns glow in their own colour, brightest at the top.
    night = mix(night, base * 1.25 + 0.15 * smoothstep(0.0, 3.0, vFacade.y - vShape.x), crown);

    vec3 color = mix(day, night, uMixRatio);
    // Lit windows and crowns shine through some of the haze at night.
    float glow = (window * lit + crown) * uMixRatio;
    gl_FragColor = vec4(mix(color, uSky, hazeAmount(vWorld) * (1.0 - 0.5 * glow)), 1.0);
}
