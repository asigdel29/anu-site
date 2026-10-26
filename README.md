# anu's island

The personal site of Anubhav "Anu" Sigdel. A small floating island hangs over a 3D New York in toy-model colours, and the sky follows the live New York weather. The visitor scrolls to fly around the island. The site uses Vite and Three.js.

## What is on the page

- **The island:** a grass slab on sand-clay pillars, about 400 m above Central Park. A cherry blossom tree stands in the middle.
- **The props:** a stick figure of Anu, a laptop on a crate, a stack of books and a mailbox.
- **The city:** Manhattan at about 1:10 in a sunny stylized look, with warm brick, cream stone and teal glass. It has its street grid, Central Park, the Hudson, the East River and the boroughs beyond.
- **Landmarks:** about 25 towers that people know New York by, from the Plaza to One World Trade Center.
- **The park:** about 1,200 stylized trees with round clustered canopies in green, cherry blossom pink and spring lime, with the Reservoir, the Lake, the Pond and the lawns. The trees sway in the wind.
- **Day and night:** the day sky is a bright cyan and the night a deep indigo. At night, windows glow warm yellow and orange and change slowly, crowns are floodlit, streets glow and aviation lights flash.
- **Live weather:** clouds, wind, rain, snow, fog and thunder follow New York now (data from Open-Meteo). The first visit starts in night mode after dark in New York.
- **The scroll tour:** each scroll moves the camera one stop: in from the city to the stick figure, around the island to each prop, then out to a high view of New York. At each prop, a marker bubble opens its section. A rail on the right shows the stops.
- **Content:** the nav at the top opens the work, about and contact dialogs. 5 seconds after the island appears, the nav and the hero card fold into small glass capsules. Hover, focus or a tap opens them again.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173, select "enter", then scroll.

## Check it

```
npm test          # unit tests: weather mapping, the city layout and the tour path
npm run e2e       # smoke test and the 20 ms main-thread budget (builds and serves the site)
```

- Set `BASE_URL` to run the browser tests against a deployed preview.
- Set `PERF_CPU_THROTTLE=4` to check the budget on a slower CPU.

## Performance budget

No main-thread task may do 20 ms or more of work, during load or after it. `tests/perf.spec.js` records a Chrome trace and enforces this in CI. Compositor commit waits are logged but not counted, because in CI they wait on software WebGL.

The site stays under the budget because of these rules:

- The site has one runtime dependency (`three`). Animation, audio and styles use the platform.
- A worker builds the city layout, so its thousands of buildings never block the page.
- The whole scene is eight draw calls. All buildings are one instanced draw call, and all trees are another.
- Shaders draw the windows, the streets and the water, so the city needs no textures.
- The WebGL context, the renderer, each texture upload and each first draw run in separate tasks.
- Images decode off the main thread, and shaders compile with `compileAsync`.
- Each frame of the tour does a little maths and moves one marker. The scroll position is read each frame, and the page size only on resize.

## How the tour works

`src/tour.js` holds the stops and the path maths. It has no DOM or WebGL code, so Node tests it. `src/explore.js` connects it to the page.

- The page has one screen of scroll per stop (`.tour-stop` in `index.html`). Scroll snapping stops at each stop.
- Each stop gives the camera an azimuth, a distance from the island's axis and a height, and a point to look at.
- Between stops, the camera moves around the island's axis, so it never goes through the tree.
- The camera eases toward the scroll position. With a mouse, it also leans a little toward the pointer.
- Each prop stop has a marker. Its position comes from an anchor in the mesh pack, above the prop.

To add a stop:

1. Add the prop and its entry to `PROPS` in `tools/blender/props.py`, then rebuild the island (see below).
2. Add the stop to `STOPS` in `src/tour.js`, between the stops it sits between. Use the prop's azimuth and distance for the target.
3. Add a `.tour-stop` section, a rail button and a marker button to `index.html`.
4. Run `npm test`. The tests fail if the camera path goes through the tree or the island, or if the target is not on the prop.

## How the city works

`src/city.js` lays out the city as plain data. It has no WebGL code, so Node tests it and the worker (`src/city.worker.js`) runs it. `src/skyline.js` turns the data into meshes, and `src/shaders/city/` colours them.

- City space is in metres. x points east, z points south, and y is up from the street.
- The street level is 40 m below the island's grass.
- Avenues are 26 m apart and streets are 8 m apart. `blockSouthOf(street)` gives the z of the block south of a numbered street.
- Towers rise in Midtown, the Financial District and the waterfronts. The other blocks are pre-war mid-rise.
- Buildings near the island stay low, so the camera never meets a wall.
- The shaders light the city like a stylized game. A warm sun lights one side of each building, and a cool blue-purple light fills the shade.
- Each building gets brighter toward its top. Its corners have a bright rim, each roof line has a cornice, and each roof has a pale parapet.
- Windows reflect the sky by day and glow warm by night. Copper and gold roofs have no windows.
- Each building on the street has storefronts: shop windows between stone piers under red, green, navy or yellow awnings. The shops stay lit at night.
- The streets have asphalt roadways, sidewalks, lane dashes and crosswalks. The water has a foam line along each shore and glints in the sun.
- Many mid-rise roofs carry a wooden water tower on steel legs. The worker places them from the layout: one on each chosen roof, in a corner, clear of the rooftop box. All the towers are one draw call.
- Yellow taxis and other cars drive one way along the avenues and streets near the island. The vertex shader moves them from the clock, so the main thread does no work for them. Each lane stops short of the park and the rivers. At night the cars show white headlights and red tail lights. When the visitor asks for less motion, they stand still.
- Three bridges cross the East River: the Brooklyn Bridge with its granite gothic towers and diagonal cable web, the blue Manhattan Bridge and the red Williamsburg Bridge. `BRIDGES` in `src/city.js` holds them, and the lots under their ramps stay empty. At night their cables wear a string of lights. All three are one draw call.
- A neat row of trees lines the park's wall on all four sides. A jittered grid of trees fills the rest.
- Each park tree is a trunk under four round canopy lobes. Each lobe has only 14 faces, so the park stays cheap to draw. The canopy is dark at its core and bright at its top. The trees sway in the wind, but not when the visitor asks for less motion.
- Without a GPU (software WebGL, as in CI), the trees draw only their trunk and core lobe, and the water towers and the cars stay hidden. Software WebGL pays for every triangle on the CPU, so this keeps the page usable there.

To add a landmark:

1. Find its avenue block and its street.
2. Add a `landmark(x, z, style, palette, [tiers])` entry to `LANDMARKS` in `src/city.js`.
3. Give each tier its footprint and its top in metres (real height divided by 10).
4. Run `npm test`. The tests fail if the landmark stands in the park or a river.

## Change the island

The island lives in `blender/island.blend` (Git LFS). Two scripts rebuild the site assets:

1. `tools/blender/build_blockout.py` makes the island scene from code (with `lib.py` and `props.py`).
2. `tools/blender/bake_export.py` bakes the day and night atlas and writes `public/models/island.bin` (with `mesh_pack.py`). The canopy keeps its light in vertex colours, so it shows no UV seams.

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/build_blockout.py
/Applications/Blender.app/Contents/MacOS/Blender -b blender/island.blend \
  --python tools/blender/bake_export.py -- --size 1024 --samples 64
```

## Licenses

- The code is MIT. It starts from Andrew Woan's [room folio](https://github.com/andrewwoan/sooahs-room-folio) tutorial, and his notice stays in `LICENSE.md`.
- The 3D island, the baked textures and the sounds belong to Anubhav Sigdel. The MIT license does not cover them.
- `CREDITS.md` lists the third-party assets and their licenses.
