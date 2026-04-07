import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Searching for specific Gemma 4 models...")
target_names = ["models/gemma-4-31b-it", "models/gemma-4-26b-a4b-it", "models/gemma-4-26b-it"]
found = []
try:
    for m in client.models.list():
        if any(t in m.name for t in target_names) or "gemma-4" in m.name.lower():
            found.append(f"{m.name} (Actions: {m.supported_actions})")

    if found:
        print("\n".join(found))
    else:
        print("No matching Gemma 4 models found beyond the ones already seen.")
except Exception as e:
    print(f"Error: {e}")
