from PIL import Image

img_path = "client/public/avatars/avatar_1.png"
try:
    img = Image.open(img_path)
    # Get top-left pixel color
    pixel = img.getpixel((0, 0))
    # Convert to hex
    hex_color = '#{:02x}{:02x}{:02x}'.format(pixel[0], pixel[1], pixel[2])
    print(f"Background Color: {hex_color}")
except Exception as e:
    print(f"Error: {e}")
