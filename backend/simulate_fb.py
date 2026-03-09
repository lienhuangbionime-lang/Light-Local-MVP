import httpx
import asyncio
import json

# 本機開發時，請確保與 uvicorn 啟動埠一致
# 目前後端日誌顯示為 http://127.0.0.1:8000
BASE_URL = "http://127.0.0.1:8000"

async def simulate_comment(user_name, comment_text):
    payload = {
        "comment": comment_text,
        "sender_id": f"user_{user_name.lower()}",
        "sender_name": user_name
    }
    print(f"\n[Simulation] {user_name} comment: {comment_text}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{BASE_URL}/webhook/fb", json=payload, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                order_id = data.get("order_id", "UNKNOWN")
                print(f"OK: Webhook received. Order ID: {order_id}")
                print(f"👉 Local Test URL: http://127.0.0.1:3000/checkout/{order_id}?backend={BASE_URL}")
            else:
                print(f"Error: Webhook failed: {response.status_code}")
    except Exception as e:
        print(f"Error: Connection failed: {e}")

async def main():
    print("=== EchoOrder Simulation Tool ===")
    
    # 1. Health check
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BASE_URL}/api/health", timeout=2.0)
            print(f"Health check: {resp.json()}")
    except Exception as e:
        print(f"Error: Cannot connect to backend ({e})")
        print("\nImportant: You must run two terminals:")
        print("   T1: uv run uvicorn main:app")
        print("   T2: uv run simulate_fb.py")
        return

    # 2. Sync products
    print("\n[Step 1] Syncing product codes (A, B)...")
    async with httpx.AsyncClient() as client:
        await client.post(f"{BASE_URL}/api/seller/active_products", json={
            "A": "dress_id_001",
            "B": "shoes_id_999"
        })

    # 3. Simulate comments
    await simulate_comment("XiaoMing", "A+1")
    await simulate_comment("DaWang", "B 加 2")
    await simulate_comment("Lily", "A + 3")

    print("\n=== Simulation Complete ===")
    print("Check backend logs for checkout links.")
    print("\n!!! IMPORTANT: USE THE EXACT LINK BELOW (DO NOT CHANGE THE ID) !!!")
    print("!!! 重要：請直接點擊或複製下方完整的網址，不要修改 ID 部分 !!!")

if __name__ == "__main__":
    asyncio.run(main())
