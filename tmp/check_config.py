import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

def check_config():
    key_paths = ["backend/serviceAccountKey.json", "serviceAccountKey.json"]
    target_path = next((p for p in key_paths if os.path.exists(p)), None)
    if not target_path:
        print("Key not found")
        return
    
    cred = credentials.Certificate(target_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    doc = db.collection("system").document("config").get()
    
    if doc.exists:
        data = doc.to_dict()
        print("Config found:")
        print(f"Processed IDs count: {len(data.get('processed_comment_ids', []))}")
        print(f"Active Products count: {len(data.get('active_products', {}))}")
        print(f"Is Live Active: {data.get('is_live_active')}")
    else:
        print("Config NOT found in system/config")

if __name__ == "__main__":
    check_config()
