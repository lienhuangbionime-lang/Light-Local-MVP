import httpx
import asyncio

async def probe_render():
    url = "https://light-local-mvp.onrender.com/"
    health_url = "https://light-local-mvp.onrender.com/api/health"
    print(f"--- Probing {url} ---")
    async with httpx.AsyncClient() as client:
        try:
            r1 = await client.get(url, timeout=10.0)
            print(f"Root: {r1.status_code}")
            print(f"Body: {r1.text[:200]}")
            
            r2 = await client.get(health_url, timeout=10.0)
            print(f"Health: {r2.status_code}")
            print(f"Body: {r2.text[:200]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(probe_render())
