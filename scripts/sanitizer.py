import os
import shutil
from datetime import datetime

# Configuration
PROJECT_ROOT = r"C:\Users\lien.huang\AppData\Local-First MVP"
TMP_DIR = os.path.join(PROJECT_ROOT, "tmp")
ARCHIVE_ROOT = os.path.join(TMP_DIR, "archive")

def sanitize():
    if not os.path.exists(ARCHIVE_ROOT):
        os.makedirs(ARCHIVE_ROOT)
    
    date_folder = datetime.now().strftime("%Y-%m-%d")
    archive_path = os.path.join(ARCHIVE_ROOT, date_folder)
    
    if not os.path.exists(archive_path):
        os.makedirs(archive_path)
    
    # Move all files from tmp/ to archive/<date>/
    for item in os.listdir(TMP_DIR):
        item_path = os.path.join(TMP_DIR, item)
        if os.path.isfile(item_path):
            shutil.move(item_path, os.path.join(archive_path, item))
            print(f"Archived: {item}")

if __name__ == "__main__":
    sanitize()
