"""
process_wordmark.py
Remueve fondo del wordmark Vera, limpia artefactos JPEG,
upscale 2x y exporta PNG transparente de alta calidad.
"""
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
import os

INPUT  = r"C:\Users\micha\Desktop\Proyectos\CostosApp\assets\vera-logos\vera completo a modificar.jpg"
OUTPUT = r"C:\Users\micha\Desktop\Proyectos\CostosApp\assets\vera-logos\vera_wordmark_transparent.png"

# ── 1. Cargar y upscale 2x para ganar resolución antes de procesar ────────────
img = Image.open(INPUT).convert('RGBA')
orig_w, orig_h = img.size
print(f'Original size: {orig_w}x{orig_h}')

# Upscale 2x con LANCZOS (mejor calidad)
scale = 2
img = img.resize((orig_w * scale, orig_h * scale), Image.LANCZOS)
print(f'Upscaled to: {img.size[0]}x{img.size[1]}')

# ── 2. Reducir artefactos JPEG con un suave blur antes de umbralizar ──────────
img_clean = img.filter(ImageFilter.GaussianBlur(0.8))
data = np.array(img_clean, dtype=np.float32)

r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]

# ── 3. Detección del teal: hue en rango cyan-teal, saturación alta ────────────
rgb_norm = data[:,:,:3] / 255.0
max_c    = rgb_norm.max(axis=2)
min_c    = rgb_norm.min(axis=2)
delta    = max_c - min_c + 1e-9

# Hue
hue = np.zeros_like(max_c)
idx_g = max_c == rgb_norm[:,:,1]
idx_b = max_c == rgb_norm[:,:,2]
idx_r = max_c == rgb_norm[:,:,0]
hue[idx_r] = (60 * ((rgb_norm[:,:,1] - rgb_norm[:,:,2]) / delta % 6))[idx_r]
hue[idx_g] = (60 * ((rgb_norm[:,:,2] - rgb_norm[:,:,0]) / delta + 2))[idx_g]
hue[idx_b] = (60 * ((rgb_norm[:,:,0] - rgb_norm[:,:,1]) / delta + 4))[idx_b]

saturation = np.where(max_c > 0, (max_c - min_c + 1e-9) / max_c, 0)
value      = max_c

# Máscara teal: hue 150-195°, saturación > 0.30, value > 0.20
is_teal = (
    (hue >= 148) & (hue <= 200) &
    (saturation >= 0.28) &
    (value >= 0.18)
)

# ── 4. Alpha con transición suave en los bordes ───────────────────────────────
alpha_raw = np.where(is_teal, 255, 0).astype(np.uint8)
alpha_img = Image.fromarray(alpha_raw, 'L')

# Dilatar 1px → blur → umbralizar (anti-aliasing en bordes)
alpha_img = alpha_img.filter(ImageFilter.MaxFilter(3))
alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(1.2))
alpha_arr = np.array(alpha_img)
# Re-umbralizar: mantener semi-transparencias solo en bordes
alpha_arr = np.clip(alpha_arr, 0, 255).astype(np.uint8)

# ── 5. Aplicar alpha a la imagen upscaleada (no la blureada) ─────────────────
result_data        = np.array(img)
result_data[:,:,3] = alpha_arr
result = Image.fromarray(result_data, 'RGBA')

# ── 6. Recortar al contenido real ─────────────────────────────────────────────
bbox = result.getbbox()
if bbox:
    result = result.crop(bbox)
    print(f'Cropped to: {bbox}  size: {result.size}')

# ── 7. Guardar PNG máxima calidad ─────────────────────────────────────────────
result.save(OUTPUT, 'PNG', optimize=False, compress_level=1)
print(f'Saved: {OUTPUT}')
print(f'Final size: {result.size[0]}x{result.size[1]} px')
print('Done ✓')
