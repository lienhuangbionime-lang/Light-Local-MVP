import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.abspath("."))

from backend.config import FIREBASE_KEY_PATH

def check_order(order_id):
    key_paths = [
        "backend/serviceAccountKey.json",
        "serviceAccountKey.json"
    ]
    target_path = next((p for p in key_paths if os.path.exists(p)), None)
    if not target_path:
        print("Key not found in backend/ or root")
        return
    
    cred = credentials.Certificate(target_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    doc = db.collection("orders").document(order_id).get()
    
    if doc.exists:
        print(f"Order {order_id} EXISTS in Firestore:")
        print(json.dumps(doc.to_dict(), indent=2, ensure_ascii=False))
    else:
        print(f"Order {order_id} does NOT exist in Firestore.")
        # Check all orders to see if ID format changed
        all_docs = db.collection("orders").limit(5).get()
        print("\nRecent orders in DB:")
        for d in all_docs:
            print(f"- {d.id}")

if __name__ == "__main__":
    check_order("ORD_98C0F8DE")
