"""Shared helpers for the island Blender scripts: colours, materials and bmesh shapes.

Imported by build_blockout.py; not run on its own.
"""

import random

import bmesh
import bpy

rng = random.Random(29)


def linear(hex_color):
    """Converts an sRGB hex colour to the linear RGBA that Blender sockets expect."""
    hex_color = hex_color.lstrip("#")
    srgb = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return (
        *[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb],
        1.0,
    )


# ---------------------------------------------------------------- materials


def principled(name, color, roughness=0.9):
    """Matte material, so the bake holds no view-dependent shine."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    return mat


def varied(name, dark, light, scale=3.0):
    """Material whose colour drifts between two shades by noise, for a hand-painted feel."""
    mat = principled(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = linear(dark)
    ramp.color_ramp.elements[1].color = linear(light)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def brick_wall(name):
    """Pink brick rows that wrap around each pillar, with per-brick colour drift from the Brick texture."""
    mat = principled(name, "#D24E68")
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    around = nodes.new("ShaderNodeMath")
    around.operation = "ADD"
    wall = nodes.new("ShaderNodeCombineXYZ")
    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.inputs["Color1"].default_value = linear("#C24260")
    brick.inputs["Color2"].default_value = linear("#E46A83")
    brick.inputs["Mortar"].default_value = linear("#8E2E48")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.03
    brick.inputs["Brick Width"].default_value = 0.94
    brick.inputs["Row Height"].default_value = 0.6
    links.new(coords.outputs["Object"], split.inputs["Vector"])
    links.new(split.outputs["X"], around.inputs[0])
    links.new(split.outputs["Y"], around.inputs[1])
    links.new(around.outputs["Value"], wall.inputs["X"])
    links.new(split.outputs["Z"], wall.inputs["Y"])
    links.new(wall.outputs["Vector"], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


# ---------------------------------------------------------------- mesh helpers


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name, bm, collection, materials):
    """Turns a bmesh into a linked object with its own mesh data and material slots."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def add_box(bm, size, center=(0, 0, 0), material=0, bevel=0.0):
    """Adds a box of full size (x, y, z) around center."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom["verts"]
    bmesh.ops.scale(bm, vec=size, verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    for face in faces:
        face.material_index = material
    if bevel:
        edges = list({e for f in faces for e in f.edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES")
    return verts
