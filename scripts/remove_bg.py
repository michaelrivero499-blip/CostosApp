"""
remove_bg.py — Remueve el fondo oscuro del logo Vera y guarda PNG transparente.
Uso: python scripts/remove_bg.py
"""
from PIL import Image
import numpy as np
import os

INPUT  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'vera-logos', 'vera_appicon_square_1024px.png')
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'vera-logos', 'vera_v_transparent_1024px.png')

img  = Image.open(INPUT).convert('RGBA')
data = np.array(img, dtype=np.float32)

r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Convertir a HSV para detectar el teal del logo
rgb_norm = data[:,:,:3] / 255.0
max_c = rgb_norm.max(axis=2)
min_c = rgb_norm.min(axis=2)
delta = max_c - min_c

# Hue aproximado (en grados 0-360)
hue = np.zeros_like(max_c)
mask_g = (max_c == rgb_norm[:,:,1]) & (delta > 0)
mask_b = (max_c == rgb_norm[:,:,2]) & (delta > 0)
mask_r = (max_c == rgb_norm[:,:,0]) & (delta > 0)

hue[mask_r] = 60 * (((rgb_norm[:,:,1] - rgb_norm[:,:,2]) / (delta + 1e-9)) % 6)[mask_r]
hue[mask_g] = 60 * (((rgb_norm[:,:,2] - rgb_norm[:,:,0]) / (delta + 1e-9)) + 2)[mask_g]
hue[mask_b] = 60 * (((rgb_norm[:,:,0] - rgb_norm[:,:,1]) / (delta + 1e-9)) + 4)[mask_b]

saturation = np.where(max_c > 0, delta / max_c, 0)
value      = max_c

# El logo Vera es teal/cyan: hue ~160-190°, saturación alta, valor medio-alto
is_teal = (
    (hue >= 150) & (hue <= 200) &   # rango cyan-teal
    (saturation >= 0.35) &           # bien saturado
    (value >= 0.25)                  # no muy oscuro
)

# Alpha: 255 si es teal, 0 si no lo es — con anti-aliasing suave en los bordes
alpha_new = np.where(is_teal, 255, 0).astype(np.uint8)

# Suavizar bordes con dilatación/erosión simple
from PIL import ImageFilter
alpha_img = Image.fromarray(alpha_new, 'L')
alpha_img = alpha_img.filter(ImageFilter.MaxFilter(3))   # dilatar 1px
alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(1.5))  # suavizar bordes

result_data        = np.array(img)
result_data[:,:,3] = np.array(alpha_img)
result = Image.fromarray(result_data, 'RGBA')

# Recortar al contenido real
bbox = result.getbbox()
if bbox:
    result = result.crop(bbox)
    print(f'Cropped to: {bbox}')

result.save(OUTPUT, 'PNG')
print(f'Saved: {OUTPUT}  |  Size: {result.size}')
