import httpx
import time
import asyncio
import hmac
import hashlib

# Mocking the admin signature generation (similar to backend verify_admin)
def generate_admin_signature(secret: str, timestamp: str) -> str:
    message = timestamp.encode()
    signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return signature

async def verify_shipping_fees():
    backend_url = "http://localhost:8000"
    admin_secret = "echo_admin_secret_123" # Replace with actual if needed or use from env
    
    # Try to get existing secret from server time debug endpoint
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{backend_url}/api/debug/time")
            print(f"Server time status: {res.json()}")
        except:
            print("Server not running or unreachable. Manual verification required.")
            return

    ts = str(int(time.time()))
    sig = generate_admin_signature(admin_secret, ts)
    headers = {
        "X-Admin-Signature": sig,
        "X-Admin-Timestamp": ts
    }

    # 1. Get current config
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{backend_url}/api/seller/config", headers=headers)
        current_config = res.json()
        print(f"Current Config: {current_config}")

    # 2. Update config with new values
    new_logistics = {
        "buyer_shipping_fee": 65,
        "platform_shipping_fee": 42,
        "free_shipping_threshold": 5
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{backend_url}/api/seller/config", json=new_logistics, headers=headers)
        print(f"Update Result: {res.json()}")

    # 3. Verify values updated in memory
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{backend_url}/api/seller/config", headers=headers)
        updated_config = res.json()
        print(f"Updated Config (in memory): {updated_config}")
        assert updated_config["buyer_shipping_fee"] == 65
        assert updated_config["platform_shipping_fee"] == 42
        assert updated_config["free_shipping_threshold"] == 5

    print("\n✅ Verification script completed successfully!")

if __name__ == "__main__":
    asyncio.run(verify_shipping_fees())
