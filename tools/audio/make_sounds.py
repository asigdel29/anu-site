"""Synthesizes the site's sounds from scratch, so no third-party audio license applies.

Writes WAV files next to this script's output folder, then encodes them to MP3 with ffmpeg:
    python3 tools/audio/make_sounds.py
Outputs public/audio/music/island.mp3 (a soft music-box loop) and public/audio/sfx/click.mp3.
Replace island.mp3 with a licensed track later if wanted; the code only needs the path.
"""

import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RATE = 44100


def write_wav(path, samples):
    """Writes mono 16-bit PCM, clipping anything outside -1..1."""
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))


def encode_mp3(wav_path, mp3_path, bitrate):
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame",
                    "-b:a", bitrate, str(mp3_path)], check=True)


def click():
    """A short soft pop: a falling sine with a fast decay."""
    length = int(RATE * 0.09)
    out = []
    phase = 0.0
    for i in range(length):
        t = i / RATE
        frequency = 520 + 480 * math.exp(-t * 60)
        phase += 2 * math.pi * frequency / RATE
        out.append(0.6 * math.sin(phase) * math.exp(-t * 45))
    return out


def music_box(seconds=32, bpm=72, seed=29):
    """A seamless loop: pentatonic bell notes over a slow two-note pad."""
    rng = random.Random(seed)
    total = int(RATE * seconds)
    out = [0.0] * total
    scale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99]  # D major pentatonic, two octaves
    beat = 60 / bpm
    step = beat / 2
    note_count = int(seconds / step)
    previous = 3
    for n in range(note_count):
        if rng.random() < 0.38:
            continue
        previous = max(0, min(len(scale) - 1, previous + rng.choice([-2, -1, -1, 1, 1, 2, 0])))
        frequency = scale[previous]
        start = int(n * step * RATE)
        loudness = 0.16 if n % 4 == 0 else 0.11
        for i in range(int(RATE * 2.5)):
            t = i / RATE
            bell = math.sin(2 * math.pi * frequency * t) + 0.3 * math.sin(2 * math.pi * frequency * 2.01 * t)
            out[(start + i) % total] += loudness * bell * math.exp(-t * 2.2) * min(1.0, t * 400)
    for i in range(total):
        t = i / RATE
        swell = 0.5 + 0.5 * math.sin(2 * math.pi * t / seconds * 2)
        out[i] += 0.05 * swell * (math.sin(2 * math.pi * 146.83 * t) + 0.6 * math.sin(2 * math.pi * 220.0 * t))
    peak = max(abs(s) for s in out)
    return [s / peak * 0.7 for s in out]


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        write_wav(tmp / "click.wav", click())
        encode_mp3(tmp / "click.wav", ROOT / "public" / "audio" / "sfx" / "click.mp3", "96k")
        write_wav(tmp / "island.wav", music_box())
        encode_mp3(tmp / "island.wav", ROOT / "public" / "audio" / "music" / "island.mp3", "96k")
    print("wrote public/audio/sfx/click.mp3 and public/audio/music/island.mp3")


main()
