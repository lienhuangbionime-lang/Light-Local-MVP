import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    exit(1)

client = genai.Client(api_key=api_key)

print("Listing models...")
try:
    for m in client.models.list():
        if "gemma" in m.name.lower():
            print(f"- {m.name} (Methods: {m.supported_actions})")
except Exception as e:
    print(f"Error listing models: {e}")
