from PIL import Image
import numpy as np

img_path = "public/images/hero/hero-portrait-cutout.png"
img = Image.open(img_path).convert("RGBA")

# Let's inspect the dimensions
width, height = img.size
print(f"Dimensions: {width}x{height}")

# Convert to numpy array
arr = np.array(img)

# Bottom fade: in the bottom 12% of the image, smoothly fade alpha from 255 to 0
fade_height = int(height * 0.12)
fade_start = height - fade_height

for y in range(fade_start, height):
    # progress from 0 (at fade_start) to 1 (at height - 1)
    t = (y - fade_start) / (fade_height - 1)
    # Smooth cosine fade
    alpha_factor = 0.5 * (1.0 + np.cos(np.pi * t))
    arr[y, :, 3] = (arr[y, :, 3].astype(float) * alpha_factor).astype(np.uint8)

out_img = Image.fromarray(arr)
out_img.save("public/images/hero/hero-portrait-cutout.png", "PNG")
print("Applied smooth feathering to bottom edge!")
