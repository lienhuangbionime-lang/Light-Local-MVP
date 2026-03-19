import firebase_admin
from firebase_admin import credentials, firestore
import os
import time
import sys

# Path fix
sys.path.insert(0, os.path.abspath("."))

from backend.models.schemas import Order, OrderItem

def test_save():
    key_paths = ["backend/serviceAccountKey.json", "serviceAccountKey.json"]
    target_path = next((p for p in key_paths if os.path.exists(p)), None)
    if not target_path: return
    
    cred = credentials.Certificate(target_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    order = Order(
        order_id="TEST_001",
        fb_user_id="user_123",
        items=[OrderItem(product_code="A", quantity=1, product_name="Test", price=100)],
        created_at=time.time()
    )
    
    try:
        db.collection("orders").document(order.order_id).set(order.dict())
        print("Save SUCCESSFUL")
    except Exception as e:
        print(f"Save FAILED: {e}")

if __name__ == "__main__":
    test_save()
