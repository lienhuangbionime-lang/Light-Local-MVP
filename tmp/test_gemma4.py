import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    model = "models/gemma-4-26b-it"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": "Hello, who are you?"}]}]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                print("Success! Gemma 4 is responding.")
                print(res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", ""))
            else:
                print(f"Error {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Network Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
