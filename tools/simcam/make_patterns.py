"""Creates neutral test images to use as SimCam camera sources.

Usage: python3 make_patterns.py
Then:  simcamctl set-source --back --image back.png
       simcamctl set-source --front --image front.png
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1512, 2016  # 3:4 portrait


def font(size):
    for path in ("/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make(name, label, top, bottom, accent):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # Vertical gradient background.
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    # Grid.
    for x in range(0, W + 1, W // 6):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255), width=2)
    for y in range(0, H + 1, H // 8):
        d.line([(0, y), (W, y)], fill=(255, 255, 255), width=2)
    # Centre circle and cross.
    r = 300
    d.ellipse([W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r], outline=accent, width=10)
    d.line([(W / 2 - r, H / 2), (W / 2 + r, H / 2)], fill=accent, width=6)
    d.line([(W / 2, H / 2 - r), (W / 2, H / 2 + r)], fill=accent, width=6)
    # Labels.
    big, mid = font(150), font(80)
    d.text((W / 2, H / 2 - 520), label, font=big, fill="white", anchor="mm")
    d.text((W / 2, 110), "TOP", font=mid, fill="white", anchor="mm")
    d.text((W / 2, H - 110), "BOTTOM", font=mid, fill="white", anchor="mm")
    d.text((70, H / 2), "L", font=mid, fill="white", anchor="mm")
    d.text((W - 70, H / 2), "R", font=mid, fill="white", anchor="mm")
    # Colour bars.
    bars = [(255, 255, 255), (255, 214, 10), (48, 209, 88), (10, 132, 255), (255, 69, 58), (20, 20, 20)]
    bw = W // len(bars)
    for i, c in enumerate(bars):
        d.rectangle([i * bw, H / 2 + 420, (i + 1) * bw, H / 2 + 560], fill=c)
    img.save(name)


make("back.png", "BACK", (24, 60, 110), (8, 20, 40), (255, 214, 10))
make("front.png", "FRONT", (110, 40, 70), (40, 10, 30), (48, 209, 88))
