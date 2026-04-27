import sys
import os

filepath = sys.argv[1]
try:
    from PIL import Image
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        sys.exit(1)
        
    img = Image.open(filepath)
    print(f"Found image: {filepath}")
    print(f"Format: {img.format}, Size: {img.size}, Mode: {img.mode}")
    
    # We expect 5 images stitched vertically
    width, height = img.size
    
    # Let's save the file locally in docs/images just in case
    os.makedirs("/Users/zumerkekillioglu/Desktop/ZMKTRENDYOL/docs/assets", exist_ok=True)
    img.save("/Users/zumerkekillioglu/Desktop/ZMKTRENDYOL/docs/assets/uploaded_stitched.jpg")
    print("Saved stitched copy")
except Exception as e:
    print(f"Error: {e}")

