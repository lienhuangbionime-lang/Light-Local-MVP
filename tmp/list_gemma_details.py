import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

try:
    for m in client.models.list():
        if "gemma" in m.name.lower():
            print(f"Name: {m.name}")
            print(f"  Description: {m.description}")
            print(f"  Supported Actions: {m.supported_actions}")
except Exception as e:
    print(f"Error: {e}")
