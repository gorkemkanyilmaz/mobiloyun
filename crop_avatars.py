from PIL import Image
import os

img_path = r"C:/Users/Gorkem/.gemini/antigravity/brain/453cffd4-e2e2-4bae-b868-c2581e1a05cc/uploaded_image_1764436462736.jpg"
output_dir = r"client/public/avatars"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

img = Image.open(img_path)
width = img.width
height = img.height

cols = 4
rows = 3
cell_w = width // cols
cell_h = height // rows

# (row, col)
females = [(0,0), (0,1), (0,2), (0,3), (1,2)]
males = [(1,0), (1,1), (2,0), (2,1), (2,2)]

def crop_and_save(cells, prefix):
    for i, (r, c) in enumerate(cells):
        left = c * cell_w
        top = r * cell_h
        right = left + cell_w
        bottom = top + cell_h
        
        # Add a small margin crop to remove grid lines if any
        margin = 10
        crop = img.crop((left + margin, top + margin, right - margin, bottom - margin))
        
        filename = f"avatar_{prefix}_{i+1}.png"
        crop.save(os.path.join(output_dir, filename))
        print(f"Saved {filename}")

crop_and_save(females, "woman")
crop_and_save(males, "man")
