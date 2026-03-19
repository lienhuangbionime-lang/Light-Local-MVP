import httpx
import asyncio
import json

async def check_local_server():
    print("--- [LOCAL TEST] checking endpoints ---")
    async with httpx.AsyncClient() as client:
        try:
            # Check Root
            r_root = await client.get('http://localhost:8888/', timeout=5.0)
            print(f"ROOT: {r_root.status_code}")
            print(json.dumps(r_root.json(), indent=2))
            
            # Check Health
            r_health = await client.get('http://localhost:8888/api/health', timeout=5.0)
            print(f"HEALTH: {r_health.status_code}")
            print(json.dumps(r_health.json(), indent=2))
            
            print("\n✅ Local server is healthy!")
        except Exception as e:
            print(f"❌ Error during local check: {e}")

if __name__ == "__main__":
    asyncio.run(check_local_server())
