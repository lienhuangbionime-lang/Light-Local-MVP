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

# Test models
test_models = ["models/gemma-4-31b-it", "models/gemini-1.5-flash"]
image_path = r"public\icon-light-32x32.png"

with open(image_path, "rb") as f:
    image_data = f.read()
    image_b64 = base64.b64encode(image_data).decode("utf-8")

for model_id in test_models:
    print(f"\n--- Testing Vision with {model_id} ---")
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=[
                types.Content(
                    parts=[
                        types.Part(text="What is in this image?"),
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
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error for {model_id}: {e}")
