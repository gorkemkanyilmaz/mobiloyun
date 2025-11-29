from PIL import Image
import os

img_path = r"C:/Users/Gorkem/.gemini/antigravity/brain/453cffd4-e2e2-4bae-b868-c2581e1a05cc/uploaded_image_1764436462736.jpg"

try:
    img = Image.open(img_path)
    print(f"Width: {img.width}, Height: {img.height}")
except ImportError:
    print("Pillow not installed")
except Exception as e:
    print(f"Error: {e}")
