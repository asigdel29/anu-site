"""Draws the pixel-art New York skyline that rings the island, using only the standard library.

Run from the repo root:
    python3 tools/skyline/make_skyline.py

Writes public/textures/skyline.png (2048 x 128, wraps around 360 degrees). The channels are
data, not colour; src/shaders/skyline/fragment.glsl turns them into day or night colours:
    R: building shade (0..1)     G: window (0 none, else brightness seed)
    B: 255 for park trees        A: 255 where something is drawn
"""

import random
import struct
import zlib
from pathlib import Path

WIDTH, HEIGHT = 2048, 128
OUT = Path(__file__).resolve().parents[2] / "public" / "textures" / "skyline.png"

rng = random.Random(1625)  # 1625: the year New Amsterdam was founded
pixels = bytearray(WIDTH * HEIGHT * 4)


def put(x, y, r, g=0, b=0):
    """Sets one pixel; x wraps around the ring, y counts up from the bottom."""
    if not 0 <= y < HEIGHT:
        return
    i = ((HEIGHT - 1 - y) * WIDTH + x % WIDTH) * 4
    pixels[i:i + 4] = bytes((r, g, b, 255))


def block(x0, width, top, shade, windows=True, bottom=0):
    """A building block from bottom to top, with a window grid that skips a border."""
    for x in range(x0, x0 + width):
        for y in range(bottom, top):
            window = 0
            inner = x0 + 1 < x < x0 + width - 2 and y < top - 2
            if windows and inner and (x - x0) % 3 == 1 and y % 4 in (1, 2):
                window = rng.randint(60, 255)
            put(x, y, shade, window)


def antenna(x, base, length, shade):
    for y in range(base, base + length):
        put(x, y, shade)


def water_tower(x, base, shade):
    """The wooden water tank that sits on so many New York roofs."""
    for dx in range(4):
        put(x + dx, base, shade)
        put(x + dx, base + 4, shade)
    for dy in range(1, 4):
        for dx in range(4):
            put(x + dx, base + dy, shade)
    put(x + 1, base + 5, shade)
    put(x + 2, base + 5, shade)


def tower(x, width, height, shade):
    """A generic tower with a random crown: flat, setback, antenna or water tower."""
    block(x, width, height, shade)
    style = rng.random()
    if style < 0.3 and width > 10:
        block(x + 3, width - 6, height + rng.randint(4, 10), shade, bottom=height)
    elif style < 0.5:
        antenna(x + width // 2, height, rng.randint(5, 12), shade)
    elif style < 0.75 and width > 6:
        water_tower(x + rng.randint(1, max(1, width - 5)), height, shade)


def empire_state(x):
    shade = 150
    block(x, 26, 70, shade)
    block(x + 4, 18, 84, shade, bottom=70)
    block(x + 8, 10, 94, shade, bottom=84)
    block(x + 11, 4, 100, shade, windows=False, bottom=94)
    antenna(x + 12, 100, 18, shade)
    antenna(x + 13, 100, 18, shade)


def chrysler(x):
    shade = 175
    block(x, 18, 66, shade)
    # Stacked arches narrowing to the needle.
    for step in range(6):
        block(x + 2 + step, 14 - 2 * step, 70 + step * 4, shade, windows=False, bottom=66 + step * 4)
    antenna(x + 8, 90, 14, shade)
    antenna(x + 9, 90, 14, shade)


def one_wtc(x):
    shade = 200
    for y in range(0, 104):
        inset = y * 9 // 104
        for dx in range(inset, 30 - inset):
            window = rng.randint(60, 255) if (dx % 3 == 1 and y % 4 in (1, 2) and y < 100) else 0
            put(x + dx, y, shade, window)
    antenna(x + 14, 104, 22, shade)
    antenna(x + 15, 104, 22, shade)


def park_trees():
    """Rounded tree crowns along the bottom, like Central Park in front of the towers."""
    x = 0
    while x < WIDTH:
        radius = rng.randint(4, 9)
        cx, cy = x + radius, rng.randint(6, 12)
        for dx in range(-radius, radius + 1):
            for dy in range(-cy, radius + 1):
                if dx * dx + max(dy, 0) ** 2 <= radius * radius:
                    put(cx + dx, cy + dy, rng.randint(90, 160), 0, 255)
        x += radius + rng.randint(1, 5)


def main():
    landmarks = {600: empire_state, 760: chrysler, 1500: one_wtc}
    x = 0
    while x < WIDTH:
        if x in landmarks or any(start <= x < start + 32 for start in landmarks):
            x += 1
            continue
        width = rng.randint(8, 28)
        # Taller towers in Midtown and the Financial District, lower blocks between.
        midtown = min(abs(x - 680), abs(x - 1500)) < 180
        height = rng.randint(40, 80) if midtown else rng.randint(18, 52)
        tower(x, width, height, rng.randint(70, 230))
        x += width + rng.choice((0, 0, 1, 2))
    for start, draw in landmarks.items():
        draw(start)
    park_trees()

    rows = b"".join(b"\0" + bytes(pixels[y * WIDTH * 4:(y + 1) * WIDTH * 4]) for y in range(HEIGHT))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(png)
    print(f"wrote {OUT} ({len(png) // 1024} KB)")


main()
