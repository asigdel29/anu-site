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
npm run e2e       # end-to-end smoke test (builds and serves the site)
```

Set `BASE_URL` to run the smoke test against a deployed preview.

## Change the 3D scene

The scene lives in `blender/island.blend` (Git LFS). Two scripts rebuild the site assets:

1. `tools/blender/build_blockout.py` makes the blockout scene from code.
2. `tools/blender/bake_export.py` bakes the day and night atlases and exports `public/models/island.glb`.

```
/Applications/Blender.app/Contents/MacOS/Blender -b blender/island.blend \
  --python tools/blender/bake_export.py -- --size 4096 --samples 1024
```

Mesh names control behaviour. Keep them in line with `src/interactions.js`; `npm test` fails when they drift.

## Licenses

- The code is MIT. It starts from Andrew Woan's [room folio](https://github.com/andrewwoan/sooahs-room-folio) tutorial, and his notice stays in `LICENSE.md`.
- The 3D model, the baked textures, the sounds and the figure's likeness belong to Anubhav Sigdel. They are not covered by the MIT license.
- Third-party assets and their licenses are listed in `CREDITS.md`.
