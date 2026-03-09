import httpx
import asyncio

BASE_URL = "http://127.0.0.1:10000"
ORDER_ID = "ORD_09564DBD"

async def confirm_order():
    payload = {
        "shipping_info": "7-11 Tech Store (Test)",
        "phone": "0988-777-666"
    }
    print(f"Confirming order {ORDER_ID}...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/api/checkout/{ORDER_ID}/confirm", json=payload)
        if response.status_code == 200:
            print("Successfully confirmed!")
        else:
            print(f"Failed: {response.status_code}")

if __name__ == "__main__":
    asyncio.run(confirm_order())
