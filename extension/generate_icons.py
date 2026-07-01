import os
from PIL import Image, ImageDraw

def create_shield_icon(size: int, filename: str):
    # Create an image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Define shield points relative to size
    s = size
    # Shield shape points: top-center, top-right, mid-right, bottom-center, mid-left, top-left
    points = [
        (s * 0.5, s * 0.1),
        (s * 0.8, s * 0.1),
        (s * 0.85, s * 0.45),
        (s * 0.5, s * 0.9),
        (s * 0.15, s * 0.45),
        (s * 0.2, s * 0.1)
    ]
    
    # Fill with indigo color #4F46E5
    draw.polygon(points, fill=(79, 70, 229, 255))
    
    # Save the file
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename, "PNG")
    print(f"Generated {filename}")

if __name__ == "__main__":
    icon_dir = os.path.join(os.path.dirname(__file__), "icons")
    create_shield_icon(16, os.path.join(icon_dir, "icon16.png"))
    create_shield_icon(48, os.path.join(icon_dir, "icon48.png"))
    create_shield_icon(128, os.path.join(icon_dir, "icon128.png"))
