# anu's island

The personal site of Anubhav "Anu" Sigdel: a floating island with a cherry blossom tree, built with Vite and Three.js.

## Run it

```
npm install
npm run dev
```

## Check it

```
npm test          # model and code contract
npm run e2e       # smoke test and the 20 ms main-thread budget (builds and serves the site)
```

Set `BASE_URL` to run the browser tests against a deployed preview. Set `PERF_CPU_THROTTLE=4` to check the budget on a slowed-down CPU.

## Performance budget

No main-thread task may do 20 ms or more of work, during load or after it. `tests/perf.spec.js` records a Chrome trace and enforces this in CI. Compositor commit waits are logged but not counted, because in CI they wait on software WebGL. The site keeps under it by:

- shipping one runtime dependency (`three`); animation, audio and styles use the platform
- creating the WebGL context, the renderer, each texture upload and each first draw in separate tasks
- decoding images off the main thread and compiling shaders with `compileAsync`
- reading the mesh pack straight into typed arrays, with bounds precomputed by the exporter

## Change the 3D scene

The scene lives in `blender/island.blend` (Git LFS). Two scripts rebuild the site assets:

1. `tools/blender/build_blockout.py` makes the blockout scene from code (with `lib.py` and `props.py`).
2. `tools/blender/bake_export.py` bakes the day and night atlases and writes `public/models/island.bin` (with `mesh_pack.py`).

```
/Applications/Blender.app/Contents/MacOS/Blender -b blender/island.blend \
  --python tools/blender/bake_export.py -- --size 4096 --samples 1024
```

Mesh names control behaviour. Keep them in line with `src/interactions.js`; `npm test` fails when they drift.

## Licenses

- The code is MIT. It starts from Andrew Woan's [room folio](https://github.com/andrewwoan/sooahs-room-folio) tutorial, and his notice stays in `LICENSE.md`.
- The 3D model, the baked textures, the sounds and the figure's likeness belong to Anubhav Sigdel. They are not covered by the MIT license.
- Third-party assets and their licenses are listed in `CREDITS.md`.
