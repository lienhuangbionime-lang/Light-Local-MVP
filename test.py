import asyncio, os
from google import genai
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "backend-cortex", ".env"))
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
print("Models:")
for m in client.models.list():
    if "flash" in m.name or "pro" in m.name:
        print(m.name)
