from fastapi.testclient import TestClient
import sys
import os
import time

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import app from backend.main
from backend.main import app
from backend.core.security import generate_admin_signature

def test_stats_endpoint():
    client = TestClient(app)
    
    print("\n=== Testing Public Stats Endpoint ===")
    response = client.get("/api/seller/stats")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    print("[SUCCESS] Public endpoint is responsive.")

def test_sync_products_endpoint():
    client = TestClient(app)
    
    print("\n=== Testing Protected Sync Products Endpoint ===")
    ts = str(int(time.time()))
    from backend.config import ADMIN_SECRET
    # In crypto.ts we use HMAC-SHA256
    sig = generate_admin_signature(ts)
    
    headers = {
        "X-Admin-Signature": sig,
        "X-Admin-Timestamp": ts
    }
    
    payload = {
        "active_products": {"A": {"name": "Test Item", "price_rule": "1:100"}},
        "is_live": True
    }
    
    response = client.post("/api/seller/sync_products", json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    if response.status_code == 200:
        print("[SUCCESS] Signature verification and endpoint logic are working!")
    elif response.status_code == 403:
        print("[ERROR] Signature verification failed (Invalid Signature).")
    else:
        print(f"[ERROR] Unexpected status code: {response.status_code}")
        
    assert response.status_code == 200

if __name__ == "__main__":
    try:
        test_stats_endpoint()
        test_sync_products_endpoint()
        print("\n[COMPLETE] All verification tests passed!")
    except Exception as e:
        print(f"\n[FAILED] Verification failed: {e}")
        sys.exit(1)
