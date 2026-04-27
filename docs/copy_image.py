import shutil
import os
import sys

source = "/Users/zumerkekillioglu/.gemini/antigravity/brain/tempmediaStorage/media__1776672579971.jpg"
dest = "/Users/zumerkekillioglu/Desktop/ZMKTRENDYOL/docs/assets/user_uploaded.jpg"

try:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(source, dest)
    print("Copied successfully to", dest)
except Exception as e:
    print("Failed to copy:", e)
