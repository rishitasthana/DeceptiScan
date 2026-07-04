from PIL import Image, ImageEnhance, ImageFilter
import os

INPUT_BASE  = "./data/processed"
OUTPUT_BASE = "./data/augmented"
TARGET_SIZE = (224, 224)

CLASSES = [
    "pre_checked_consent",
    "hidden_unsubscribe",
    "misleading_cta_color",
    "small_print_placement",
    "clean",
]

def augment_image(img):
    variants = []
    variants.append(img.resize(TARGET_SIZE))
    variants.append(img.transpose(Image.FLIP_LEFT_RIGHT).resize(TARGET_SIZE))
    variants.append(ImageEnhance.Brightness(img).enhance(1.3).resize(TARGET_SIZE))
    variants.append(ImageEnhance.Brightness(img).enhance(0.7).resize(TARGET_SIZE))
    variants.append(ImageEnhance.Contrast(img).enhance(1.4).resize(TARGET_SIZE))
    variants.append(img.filter(ImageFilter.GaussianBlur(radius=1)).resize(TARGET_SIZE))
    w, h = img.size
    variants.append(img.crop((0, 0, w, h//2)).resize(TARGET_SIZE))
    variants.append(img.crop((0, h//2, w, h)).resize(TARGET_SIZE))
    return variants

for cls in CLASSES:
    input_dir  = os.path.join(INPUT_BASE, cls)
    output_dir = os.path.join(OUTPUT_BASE, cls)
    os.makedirs(output_dir, exist_ok=True)
    if not os.path.exists(input_dir):
        print(f"Skipping {cls} — not found")
        continue
    files = [f for f in os.listdir(input_dir) if f.endswith((".png", ".jpg"))]
    print(f"{cls}: {len(files)} images -> {len(files)*8} augmented")
    count = 0
    for fname in files:
        try:
            img = Image.open(os.path.join(input_dir, fname)).convert("RGB")
            for i, v in enumerate(augment_image(img)):
                v.save(os.path.join(output_dir, f"{fname[:-4]}_aug{i}.png"))
                count += 1
        except Exception as e:
            print(f"  Error {fname}: {e}")
    print(f"  Saved {count} images")

print("\nAugmentation complete!")
