import firebase_admin
from firebase_admin import credentials, firestore
import os

def list_collections():
    key_paths = ["backend/serviceAccountKey.json", "serviceAccountKey.json"]
    target_path = next((p for p in key_paths if os.path.exists(p)), None)
    if not target_path:
        print("Key not found")
        return
    
    cred = credentials.Certificate(target_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    collections = db.collections()
    print("Available Collections:")
    for col in collections:
        doc_count = len(list(col.limit(10).get()))
        print(f"- {col.id} (approx {doc_count}+ docs)")

if __name__ == "__main__":
    list_collections()
