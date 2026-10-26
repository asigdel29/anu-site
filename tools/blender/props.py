"""Tour props of the island: the stick figure, the work laptop, the books and the mailbox.

Imported by build_blockout.py. Each prop stands at a tour stop and faces out from the island
centre, where the tour camera looks at it. An empty named Anchor_<stop> above each prop tells
the site where to put that stop's marker (bake_export.py writes the anchors into the mesh pack).
"""

import math

import bmesh
import bpy
from mathutils import Matrix

from lib import add_box, add_cylinder, add_limb, add_sphere, mesh_object, principled, varied


def around(radius, azimuth):
    """Blender XY of a point on the island, from the site's camera azimuth in degrees.

    The site is Y-up with z = -Blender y, so its azimuth atan2(z, x) is the negated Blender angle.
    """
    angle = math.radians(-azimuth)
    return radius * math.cos(angle), radius * math.sin(angle)


def facing_out(azimuth):
    """Z rotation that turns a prop's front (local -Y) away from the island centre."""
    return math.radians(90 - azimuth)


def place(obj, radius, azimuth):
    x, y = around(radius, azimuth)
    obj.location = (x, y, 0)
    obj.rotation_euler.z = facing_out(azimuth)


def add_anchor(col, stop, radius, azimuth, height):
    """An empty above a prop; the site puts the stop's marker there."""
    anchor = bpy.data.objects.new(f"Anchor_{stop}", None)
    anchor.empty_display_type = "SPHERE"
    anchor.empty_display_size = 0.1
    x, y = around(radius, azimuth)
    anchor.location = (x, y, height)
    col.objects.link(anchor)


def build_stick_figure(col):
    """Anu as a plain stick figure, waving with the right arm."""
    ink = principled("Stick", "#2E3250", roughness=0.7)
    bm = bmesh.new()
    hip, shoulder, elbow = (0, 0, 0.92), (0, 0, 1.4), (0.34, 0, 1.62)
    add_limb(bm, hip, (0, 0, 1.52), 0.05)
    add_limb(bm, hip, (-0.2, 0, 0.05), 0.05)
    add_limb(bm, hip, (0.2, 0, 0.05), 0.05)
    add_limb(bm, shoulder, (-0.38, 0, 0.98), 0.05)
    add_limb(bm, shoulder, elbow, 0.05)
    add_limb(bm, elbow, (0.44, 0, 1.95), 0.05)
    add_sphere(bm, 0.2, center=(0, 0, 1.74), subdivisions=3)
    return mesh_object("Prop_About", bm, col, [ink])


def build_laptop(col):
    """An open laptop on a wooden crate; the screen glows in the bake."""
    wood = varied("Crate", "#E8924A", "#F7B26B", scale=6.0)
    shell = principled("Laptop", "#E6E8F0", roughness=0.6)
    screen = principled("Laptop_Screen", "#7FE3FF", emission="#7FE3FF", strength=1.5)
    bm = bmesh.new()
    add_box(bm, (0.72, 0.52, 0.46), center=(0, 0, 0.23), bevel=0.03)
    add_box(bm, (0.48, 0.34, 0.03), center=(0, -0.02, 0.475), material=1)
    lid = add_box(bm, (0.48, 0.025, 0.32), center=(0, 0.15, 0.65), material=1)
    for face in {f for v in lid for f in v.link_faces}:
        if face.normal.y < -0.9:
            face.material_index = 2
    bmesh.ops.rotate(bm, verts=lid, cent=(0, 0.15, 0.49), matrix=Matrix.Rotation(math.radians(-14), 3, "X"))
    return mesh_object("Prop_Work", bm, col, [wood, shell, screen])


def build_books(col):
    """A stack of three books and an open notebook beside it."""
    covers = [principled(f"Book_{n}", c) for n, c in (("Pink", "#FF7EA8"), ("Lilac", "#B48CFF"), ("Yellow", "#FFD24D"))]
    paper = principled("Paper", "#FFF8EC")
    bm = bmesh.new()
    z = 0.0
    for index, (size, turn) in enumerate((((0.46, 0.34, 0.08), 0), ((0.42, 0.31, 0.075), 9), ((0.4, 0.28, 0.07), -6))):
        verts = add_box(bm, size, center=(-0.12, 0, z + size[2] / 2), material=index)
        bmesh.ops.rotate(bm, verts=verts, cent=(-0.12, 0, 0), matrix=Matrix.Rotation(math.radians(turn), 3, "Z"))
        z += size[2]
    for side in (-1, 1):
        page = add_box(bm, (0.26, 0.36, 0.025), center=(0.42 + side * 0.13, -0.08, 0.02), material=3)
        bmesh.ops.rotate(bm, verts=page, cent=(0.42, -0.08, 0.01), matrix=Matrix.Rotation(math.radians(side * -6), 3, "Y"))
    return mesh_object("Prop_Writing", bm, col, [*covers, paper])


def build_mailbox(col):
    """A round-topped mailbox on a post, with its flag up."""
    red = principled("Mailbox", "#FF5A5F", roughness=0.6)
    wood = principled("Post", "#9A6440")
    flag = principled("Flag", "#FFD34D")
    bm = bmesh.new()
    add_cylinder(bm, 0.045, 0.95, center=(0, 0, 0.475), material=1)
    add_box(bm, (0.3, 0.5, 0.24), center=(0, 0, 1.03))
    add_cylinder(bm, 0.15, 0.5, center=(0, 0, 1.15), segments=16, axis="Y")
    add_box(bm, (0.02, 0.02, 0.26), center=(0.165, 0.12, 1.15), material=2)
    add_box(bm, (0.02, 0.15, 0.09), center=(0.165, 0.05, 1.24), material=2)
    return mesh_object("Prop_Contact", bm, col, [red, wood, flag])


# Stop name -> (builder, distance from the island centre, site azimuth in degrees, marker height).
# The tour stops in src/tour.js look at these points; their cameras stand a little further round.
PROPS = {
    "about": (build_stick_figure, 1.8, 12, 2.4),
    "work": (build_laptop, 2.0, 95, 1.3),
    "writing": (build_books, 2.1, 170, 0.75),
    "contact": (build_mailbox, 2.1, 280, 1.75),
}


def build_props(col, anchor_col):
    """Builds every tour prop with its marker anchor."""
    for stop, (build, radius, azimuth, height) in PROPS.items():
        prop = build(col)
        prop["texel_weight"] = 1.2
        place(prop, radius, azimuth)
        add_anchor(anchor_col, stop, radius, azimuth, height)
