"""Generates the extension icons: a minimal monochrome calendar mark."""
from PIL import Image, ImageDraw
S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=112, fill=(17, 17, 17, 255))
w = (255, 255, 255, 255)
d.rounded_rectangle([120, 150, 392, 398], radius=30, outline=w, width=28)
d.line([(120, 228), (392, 228)], fill=w, width=28)
for x in (196, 316):
    d.line([(x, 112), (x, 180)], fill=w, width=28)
d.ellipse([306, 290, 350, 334], fill=(74, 222, 128, 255))
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"icons/{size}.png")
print("icons written")
