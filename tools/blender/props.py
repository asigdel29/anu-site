"""Interactive props of the island blockout; their names follow the scene contract the site reads."""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix

from lib import (FACE_CAMERA, add_box, add_cylinder, add_sphere, mesh_object, pixel_block,
                 principled, rng, spot, varied)

FONT_PATH = Path(__file__).resolve().parents[2] / "blender" / "fonts" / "SpaceGrotesk-Bold.ttf"
# Props are drawn larger than life so they read and click well at island scale.
PROP_SCALE = 1.5


def build_props(col):
    """Interactive props; names follow the scene contract the site code reads."""
    clay = principled("Figure_Clay", "#D8C3A8")
    phone_body = principled("Phone_Body", "#22252E")
    phone_screen = principled("Phone_Screen_Glow", "#7FE3D2", emission="#5EEAD4", strength=4.0)
    paper = principled("Paper", "#FAF7F0")
    cover = principled("Notebook_Cover", "#3A3450")
    book = principled("Book_Cover", "#1F4E5F")
    metal = principled("Robot_Metal", "#9AA3AE", roughness=0.8)
    card = principled("Card", "#FFFFFF")
    stone = varied("Stone", "#7F8796", "#A3AAB8", per_object=True)
    dirt = pixel_block("Block_Dirt", "#7A5536", "#94693F")
    turf = pixel_block("Block_Turf", "#5FA84E", "#7CC16A")
    letter = principled("Letter", "#F7F2EA")

    # Phone leans on the trunk; the screen face is its own material so it can glow at night.
    bm = bmesh.new()
    add_box(bm, (0.26, 0.045, 0.52), center=(0, 0, 0.26), bevel=0.02)
    for face in bm.faces:
        if face.normal.y < -0.9:
            face.material_index = 1
    phone = mesh_object("Phone_Second_Raycaster_Pointer_Hover", bm, col, [phone_body, phone_screen],
                        location=spot(0.55, -0.3))
    phone.rotation_euler = (math.radians(-12), 0, FACE_CAMERA)

    # ANU letters by the roots.
    for index, (char, right) in enumerate((("A", -0.85), ("N", 0.0), ("U", 0.85)), start=1):
        curve = bpy.data.curves.new(f"Letter_{char}", "FONT")
        curve.body = char
        curve.font = bpy.data.fonts.load(str(FONT_PATH), check_existing=True)
        curve.size = 0.85
        curve.extrude = 0.07
        curve.bevel_depth = 0.01
        curve.align_x = "CENTER"
        text = bpy.data.objects.new("text_tmp", curve)
        col.objects.link(text)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(text.evaluated_get(depsgraph))
        bpy.data.objects.remove(text)
        mesh.transform(Matrix.Rotation(math.radians(90), 4, "X"))
        mesh.transform(Matrix.Translation((0, 0, 0.01)))
        mesh.materials.clear()
        mesh.materials.append(letter)
        name = f"Name_Letter_{index}_Second_Raycaster_Pointer_Hover"
        mesh.name = name
        obj = bpy.data.objects.new(name, mesh)
        obj.location = spot(1.6, right)
        obj.rotation_euler.z = FACE_CAMERA
        col.objects.link(obj)

    # Lying figure (placeholder clay until the likeness pass): head toward the trunk, looking up.
    bm = bmesh.new()
    add_cylinder(bm, 0.17, 0.62, center=(-0.1, 0, 0.17), axis="X")
    add_cylinder(bm, 0.075, 0.85, center=(0.62, 0.09, 0.08), axis="X")
    add_cylinder(bm, 0.075, 0.85, center=(0.62, -0.09, 0.08), axis="X")
    add_sphere(bm, 0.14, center=(-0.6, 0, 0.17))
    add_cylinder(bm, 0.05, 0.42, center=(-0.48, 0.2, 0.12), axis="X")
    add_cylinder(bm, 0.05, 0.42, center=(-0.48, -0.2, 0.12), axis="X")
    mesh_object("Anu_Figure_Second_Raycaster_Pointer_Hover", bm, col, [clay],
                location=spot(1.1, 1.8), rotation_z=FACE_CAMERA)

    # Paper airplane, solid enough to render from both sides.
    bm = bmesh.new()
    verts = [bm.verts.new(co) for co in ((0.4, 0, 0.06), (-0.3, 0, 0.06), (-0.3, 0.26, 0.13), (-0.3, -0.26, 0.13), (-0.3, 0, -0.04))]
    for a, b, c in ((0, 1, 2), (0, 3, 1), (0, 4, 1)):
        bm.faces.new((verts[a], verts[b], verts[c]))
    bmesh.ops.translate(bm, vec=(0, 0, 0.04), verts=bm.verts)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
    mesh_object("Paper_Airplane_Second_Raycaster_Pointer_Hover", bm, col, [paper],
                location=spot(2.2, 1.6), rotation_z=FACE_CAMERA + math.radians(30))

    # Open notebook and the Neuromancer paperback (spine text comes with the final art).
    bm = bmesh.new()
    add_box(bm, (0.78, 0.5, 0.015), center=(0, 0, 0.0075), material=1)
    left = add_box(bm, (0.37, 0.46, 0.035), center=(-0.19, 0, 0.03))
    bmesh.ops.rotate(bm, verts=left, cent=(0, 0, 0.015), matrix=Matrix.Rotation(math.radians(7), 3, "Y"))
    right = add_box(bm, (0.37, 0.46, 0.035), center=(0.19, 0, 0.03))
    bmesh.ops.rotate(bm, verts=right, cent=(0, 0, 0.015), matrix=Matrix.Rotation(math.radians(-7), 3, "Y"))
    mesh_object("Writing_Notebook_Second_Raycaster_Pointer_Hover", bm, col, [paper, cover],
                location=spot(1.9, -1.6), rotation_z=FACE_CAMERA + math.radians(15))

    bm = bmesh.new()
    add_box(bm, (0.32, 0.48, 0.07), center=(0, 0, 0.035), bevel=0.01)
    mesh_object("Writing_Book_Second_Raycaster_Pointer_Hover", bm, col, [book],
                location=spot(1.5, -2.2), rotation_z=FACE_CAMERA - math.radians(25))

    # Robotic hand holding a playing card.
    bm = bmesh.new()
    add_cylinder(bm, 0.09, 0.25, center=(0, 0, 0.125))
    add_box(bm, (0.28, 0.1, 0.26), center=(0, 0, 0.38), bevel=0.015)
    for x in (-0.1, -0.035, 0.035, 0.1):
        add_cylinder(bm, 0.034, 0.2, center=(x, 0.0, 0.6), segments=8)
    add_cylinder(bm, 0.034, 0.18, center=(-0.19, 0.0, 0.42), segments=8, axis="X")
    add_box(bm, (0.24, 0.008, 0.34), center=(0, -0.06, 0.74), material=1)
    mesh_object("Robot_Hand_Second_Raycaster_Pointer_Hover", bm, col, [metal, card],
                location=spot(-0.3, 2.2), rotation_z=FACE_CAMERA)

    # Stepping stones toward the front corner: github, linkedin, x.
    for name, (forward, right) in (("GitHub", (3.3, 0.0)), ("LinkedIn", (2.75, -0.35)), ("X", (2.25, 0.25))):
        bm = bmesh.new()
        verts = add_cylinder(bm, 0.36, 0.1, center=(0, 0, 0.05), segments=12)
        bmesh.ops.scale(bm, vec=(1, 0.8, 1), verts=verts)
        mesh_object(f"Stone_{name}_Second_Raycaster_Pointer_Hover", bm, col, [stone],
                    location=spot(forward, right), rotation_z=rng.uniform(0, math.tau))

    # Voxel block: turf on top, dirt on the sides.
    bm = bmesh.new()
    add_box(bm, (0.5, 0.5, 0.5), center=(0, 0, 0.25))
    for face in bm.faces:
        if face.normal.z > 0.9:
            face.material_index = 1
    mesh_object("Minecraft_Block_Second_Raycaster_Pointer_Hover", bm, col, [dirt, turf],
                location=spot(-0.6, -2.1), rotation_z=math.radians(20))
    # Scaling the mesh data keeps object scale at (1,1,1) and the origin at the base.
    for obj in col.objects:
        obj.data.transform(Matrix.Scale(PROP_SCALE, 4))
