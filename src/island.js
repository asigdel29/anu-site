// Loads the island model and its baked day/night atlases without long main-thread tasks.

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  ImageBitmapLoader,
  LinearFilter,
  Mesh,
  SRGBColorSpace,
  ShaderMaterial,
  Sphere,
  Texture,
  Vector3,
} from "three";

import vertexShader from "./shaders/theme/vertex.glsl?raw";
import fragmentShader from "./shaders/theme/fragment.glsl?raw";

/** Baked atlas names; each is a substring of the mesh names that use it. */
const ATLASES = ["First", "Second"];

/** Phones and small tablets get the smaller atlases to stay inside iOS GPU limits. */
const TEXTURE_TIER =
  Math.min(screen.width, screen.height) < 768 ? "mobile" : "desktop";

/** Decodes images off the main thread (createImageBitmap) instead of during upload. */
const bitmapLoader = new ImageBitmapLoader().setOptions({
  imageOrientation: "none",
  premultiplyAlpha: "none",
});

/** One day/night blend material per atlas; the theme drives uMixRatio. */
export const islandMaterials = ATLASES.map(
  () =>
    new ShaderMaterial({
      uniforms: {
        uDayTexture: { value: null },
        uNightTexture: { value: null },
        uMixRatio: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    })
);

/**
 * Reads the mesh pack written by tools/blender/bake_export.py: a uint32 header length, a
 * JSON header, then quantized vertex data used as-is through typed-array views.
 */
async function loadMeshPack(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  const dataStart = 4 + headerLength;

  const root = new Group();
  for (const node of header.nodes) {
    const geometry = new BufferGeometry();
    const positions = new Int16Array(buffer, dataStart + node.positions, node.count * 3);
    const uvs = new Uint16Array(buffer, dataStart + node.uvs, node.count * 2);
    const IndexArray = node.indexType === 32 ? Uint32Array : Uint16Array;
    geometry.setAttribute("position", new BufferAttribute(positions, 3, true));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2, true));
    geometry.setIndex(new BufferAttribute(new IndexArray(buffer, dataStart + node.indices, node.indexCount), 1));
    // Bounds come from the header: computing them would walk every vertex on the main thread.
    geometry.boundingBox = new Box3(new Vector3().fromArray(node.min), new Vector3().fromArray(node.max));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());

    // The node scale also undoes the position quantization.
    const mesh = new Mesh(geometry);
    mesh.name = node.name;
    mesh.position.fromArray(node.position);
    mesh.quaternion.fromArray(node.quaternion);
    mesh.scale.fromArray(node.scale);
    root.add(mesh);
  }
  return root;
}

async function loadAtlas(mode, atlas) {
  const bitmap = await bitmapLoader.loadAsync(
    `/textures/island/${mode}/${atlas.toLowerCase()}_${TEXTURE_TIER}.webp`
  );
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads the model and atlases, uploads each texture in its own task and compiles shaders
 * without blocking, then adds the island to the scene and returns its root.
 */
export async function loadIsland({ scene, camera, renderer, yieldToMain }) {
  const [island, ...textures] = await Promise.all([
    loadMeshPack("/models/island.bin"),
    ...ATLASES.flatMap((atlas) => [loadAtlas("day", atlas), loadAtlas("night", atlas)]),
  ]);

  islandMaterials.forEach((material, index) => {
    material.uniforms.uDayTexture.value = textures[index * 2];
    material.uniforms.uNightTexture.value = textures[index * 2 + 1];
  });

  for (const mesh of island.children) {
    const index = ATLASES.findIndex((atlas) => mesh.name.includes(atlas));
    if (index >= 0) mesh.material = islandMaterials[index];
  }

  for (const texture of textures) {
    renderer.initTexture(texture);
    await yieldToMain();
  }

  scene.add(island);
  await renderer.compileAsync(scene, camera);
  return island;
}
