import os
from rembg import remove
from PIL import Image

input_path = "public/images/hero/hero-portrait.jpg"
output_path = "public/images/hero/hero-portrait-cutout.png"

print(f"Reading {input_path}...")
input_image = Image.open(input_path)

print("Removing background with rembg...")
output_image = remove(input_image)

print(f"Saving cutout to {output_path}...")
output_image.save(output_path, "PNG")
print("Cutout saved successfully!")
