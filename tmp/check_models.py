import os
import json
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url)
            if res.status_code == 200:
                models = res.json().get("models", [])
                for m in models:
                    if "gemma-4" in m["name"].lower():
                        print(f"MATCH: {m['name']}")
                if not any("gemma-4" in m["name"].lower() for m in models):
                    print("No Gemma 4 models found in this API response.")
            else:
                print(f"API Error {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Network Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
