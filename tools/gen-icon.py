#!/usr/bin/env python3
# Генератор иконок Muse: Android (legacy + adaptive foreground) и Windows (icon.ico)
# Стиль: тёмный фон #121212, градиентный диск красный→оранжевый, белая нота ♫
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024
RED = (255, 51, 51)
ORANGE = (255, 122, 0)
WHITE = (255, 255, 255, 255)


def radial_circle(size, c1, c2, radius):
    """Круг с радиальным градиентом c1(центр)->c2(край), прозрачный снаружи."""
    r = float(radius)
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    cx = cy = size / 2.0
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    t = np.clip(d / r, 0.0, 1.0)
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = (c1[i] * (1 - t) + c2[i] * t).astype(np.uint8)
    arr[..., 3] = np.where(d <= r, 255, 0).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def draw_note(img, scale=1.0, color=WHITE):
    """Двойная нота ♫ (головки + стержни + перекладина)."""
    d = ImageDraw.Draw(img)
    w = lambda v: int(round(v * scale))
    cx = cy = S / 2.0
    ox = lambda v: int(round(cx + v * scale))
    oy = lambda v: int(round(cy + v * scale))
    d.ellipse([ox(-126), oy(26), ox(10), oy(146)], fill=color)
    d.ellipse([ox(14), oy(26), ox(150), oy(146)], fill=color)
    sw = max(1, w(44))
    d.line([ox(8), oy(116), ox(8), oy(-168)], fill=color, width=sw)
    d.line([ox(148), oy(116), ox(148), oy(-168)], fill=color, width=sw)
    d.polygon(
        [(ox(-26), oy(-156)), (ox(176), oy(-216)), (ox(176), oy(-146)), (ox(-26), oy(-86))],
        fill=color,
    )
    return img


def dark_bg(size):
    """Вертикальный градиент фона #1b1b22 -> #0c0c11 с красным свечением сверху."""
    y = np.linspace(0, 1, size).astype(np.float32)[:, None]
    a = np.array([27, 27, 34], dtype=np.float32)
    b = np.array([12, 12, 17], dtype=np.float32)
    row = (a[None, :] * (1 - y) + b[None, :] * y)          # (size, 3)
    arr = np.repeat(row[:, None, :], size, axis=1)         # (size, size, 3)
    bg = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    glow = radial_circle(size, (255, 60, 0), (0, 0, 0), size * 0.62)
    glow = glow.rotate(0)
    bg = Image.alpha_composite(bg, glow.point(lambda p: int(p * 0.16)))
    return bg


def legacy_master(round_clip=False):
    """Полноразмерная иконка: тёмный скруглённый квадрат + диск + нота."""
    img = dark_bg(S).copy()
    mask = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(mask)
    if round_clip:
        d.ellipse([0, 0, S, S], fill=255)
    else:
        d.rounded_rectangle([0, 0, S, S], radius=232, fill=255)
    disk = radial_circle(S, RED, ORANGE, 300)
    draw_note(disk, scale=0.92)
    img = Image.composite(disk, img, disk.split()[3])
    # лёгкий «глянец» поверх диска
    gloss = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.pieslice([-S * 0.1, -S * 0.1, S * 0.9, S * 0.9], 200, 300, fill=(255, 255, 255, 26))
    img = Image.alpha_composite(img, gloss)
    img.putalpha(mask)
    return img


def adaptive_foreground():
    """Только диск+нота, прозрачный фон, в центре ~62% холста (safe zone)."""
    art = radial_circle(S, RED, ORANGE, 300)
    draw_note(art, scale=0.92)
    k = 0.62
    small = art.resize((int(S * k), int(S * k)), Image.LANCZOS)
    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    off = (S - small.width) // 2
    fg.alpha_composite(small, (off, off))
    return fg


def main():
    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    legacy = legacy_master(False)
    round_icon = legacy_master(True)
    fg = adaptive_foreground()
    for name, px in densities.items():
        mdir = os.path.join(res, "mipmap-" + name)
        legacy.resize((px, px), Image.LANCZOS).save(os.path.join(mdir, "ic_launcher.png"))
        round_icon.resize((px, px), Image.LANCZOS).save(os.path.join(mdir, "ic_launcher_round.png"))
        fg.resize((px, px), Image.LANCZOS).save(os.path.join(mdir, "ic_launcher_foreground.png"))
        print("mipmap-" + name, "OK")
    # Windows / electron-builder
    ebuild = os.path.join(ROOT, "electron", "build")
    os.makedirs(ebuild, exist_ok=True)
    icon256 = legacy.resize((256, 256), Image.LANCZOS)
    icon256.save(os.path.join(ebuild, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    icon256.save(os.path.join(ebuild, "icon.png"))
    print("electron/build/icon.ico OK")


if __name__ == "__main__":
    main()