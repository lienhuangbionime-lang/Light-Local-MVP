import os
import base64
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

image_path = r"c:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03\51a585b5-1fc1-458c-bba2-ee8c7cae976d.jpg"
if not os.path.exists(image_path):
    print(f"Error: image not found at {image_path}")
    exit(1)

with open(image_path, "rb") as f:
    image_data = f.read()
    image_b64 = base64.b64encode(image_data).decode("utf-8")

print(f"Testing OCR Transcription for Store Image with models/gemma-4-31b-it")
try:
    response = client.models.generate_content(
        model="models/gemma-4-31b-it",
        contents=[
            types.Content(
                parts=[
                    types.Part(text="請把這張圖片中所有可見的文字，一字不漏地轉錄為純文字。不要翻譯、不要解釋、不要加任何說明，只輸出原始文字內容。"),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/jpeg",
                            data=image_b64
                        )
                    )
                ]
            )
        ]
    )
    print("\n--- OCR TRANSCRIPTION ---")
    print(response.text)
    print("--- END ---")
except Exception as e:
    print(f"FAILED: {e}")
