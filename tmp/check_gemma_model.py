import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    model = "models/gemma-4-31b-it"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model}?key={api_key}"
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                print(f"Model ID: {data.get('name')}")
                print(f"Description: {data.get('description')}")
                methods = data.get('supportedGenerationMethods', [])
                print(f"Supported Methods: {methods}")
                
                # 判定是否支援視覺 (Vision)
                # 凡是支援視覺的模型，description 通長會提到 multimodal 或 vision
                desc = data.get('description', '').lower()
                is_multimodal = 'vision' in desc or 'multimodal' in desc or 'image' in desc
                print(f"\n視覺支援 (Vision Support): {'YES' if is_multimodal else 'NO (Text-Only)'}")
            else:
                print(f"Error {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Network Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
