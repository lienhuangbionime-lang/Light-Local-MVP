import os
import base64
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    exit(1)

client = genai.Client(api_key=api_key)

image_path = r"public\icon-light-32x32.png"
if not os.path.exists(image_path):
    print(f"Error: image not found at {image_path}")
    exit(1)

with open(image_path, "rb") as f:
    image_data = f.read()
    image_b64 = base64.b64encode(image_data).decode("utf-8")

print(f"Testing vision support for: models/gemma-4-31b-it")
try:
    response = client.models.generate_content(
        model="models/gemma-4-31b-it",
        contents=[
            types.Content(
                parts=[
                    types.Part(text="Identify the colors in this icon and what it resembles in one sentence."),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/png",
                            data=image_b64
                        )
                    )
                ]
            )
        ]
    )
    print("\n--- PROOF START ---")
    print(f"MODEL: models/gemma-4-31b-it")
    print(f"IMAGE: {image_path}")
    print(f"RESPONSE: {response.text}")
    print("--- PROOF END ---")
except Exception as e:
    print(f"FAILED: {e}")
