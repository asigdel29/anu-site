"""Writes the mesh pack the site loads (public/models/island.bin); used by bake_export.py."""

import json
import struct
from array import array

import bpy

BAKE_UV = "Bake"


def export_mesh_pack(objects, path, anchors=()):
    """Writes the mesh pack the site reads with typed-array views, so it needs no decoder.

    Layout: uint32 header length, JSON header (space-padded to 4 bytes), then per mesh
    Int16 positions (normalized, scaled by the node scale), Uint16 UVs or, for meshes with
    "Day" and "Night" vertex colours, Uint8 sRGB colours (day RGB, night RGB), and Uint16/32
    indices.
    Each node also lists its local bounds (min/max) in the same normalized units.
    anchors are empties named Anchor_<stop>; the header maps each stop to its position, where
    the site puts that stop's marker.
    Coordinates are converted from Blender Z-up to Y-up, and V is flipped like glTF.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    nodes, chunks, offset = [], [], 0

    def append(data):
        nonlocal offset
        data = bytes(data) + b"\0" * ((-len(data)) % 4)
        chunks.append(data)
        start = offset
        offset += len(data)
        return start

    for obj in objects:
        mesh = obj.evaluated_get(depsgraph).to_mesh()
        mesh.calc_loop_triangles()
        uv_data = mesh.uv_layers[BAKE_UV].data if BAKE_UV in mesh.uv_layers else None
        colour_data = [mesh.color_attributes[n].data for n in ("Day", "Night")] if "Day" in mesh.color_attributes else None
        lookup, positions, uvs, colours, indices = {}, [], [], [], []
        for triangle in mesh.loop_triangles:
            for loop_index in triangle.loops:
                vertex_index = mesh.loops[loop_index].vertex_index
                u, v = uv_data[loop_index].uv if uv_data is not None else (0, 0)
                key = (vertex_index, round(u, 6), round(v, 6))
                if key not in lookup:
                    lookup[key] = len(positions)
                    co = mesh.vertices[vertex_index].co
                    positions.append((co.x, co.z, -co.y))
                    uvs.append((u, 1 - v))
                    if colour_data is not None:
                        colours.extend(round(c * 255) for layer in colour_data for c in layer[vertex_index].color_srgb[:3])
                indices.append(lookup[key])
        obj.evaluated_get(depsgraph).to_mesh_clear()

        # Symmetric per-axis range keeps the object origin as the pivot for hover scaling.
        extent = [max(max(abs(p[axis]) for p in positions), 1e-6) for axis in range(3)]
        quantized = array("h", (round(p[axis] / extent[axis] * 32767) for p in positions for axis in range(3)))
        uv_values = array("H", (min(65535, max(0, round(c * 65535))) for uv in uvs for c in uv))
        colour_values = bytes(min(255, max(0, c)) for c in colours)
        index_type = "H" if len(positions) <= 65535 else "I"

        location, rotation, scale = obj.matrix_world.decompose()
        nodes.append({
            "name": obj.name,
            "position": [location.x, location.z, -location.y],
            "quaternion": [rotation.x, rotation.z, -rotation.y, rotation.w],
            "scale": [extent[0] * scale.x, extent[1] * scale.z, extent[2] * scale.y],
            # Local bounds in quantized units, so the site never walks vertices to find them.
            "min": [min(p[axis] for p in positions) / extent[axis] for axis in range(3)],
            "max": [max(p[axis] for p in positions) / extent[axis] for axis in range(3)],
            "count": len(positions),
            "indexCount": len(indices),
            "indexType": 16 if index_type == "H" else 32,
            "positions": append(quantized.tobytes()),
            **({"uvs": append(uv_values.tobytes())} if uv_data is not None else {}),
            **({"colours": append(colour_values)} if colour_data is not None else {}),
            "indices": append(array(index_type, indices).tobytes()),
        })

    anchor_positions = {
        anchor.name.removeprefix("Anchor_"): [anchor.location.x, anchor.location.z, -anchor.location.y]
        for anchor in anchors
    }
    header = json.dumps({"nodes": nodes, "anchors": anchor_positions}).encode()
    header += b" " * ((-len(header)) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<I", len(header)) + header + b"".join(chunks))
