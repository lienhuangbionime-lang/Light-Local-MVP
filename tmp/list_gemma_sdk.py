import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# 替換成你在 AI Studio 申請的 API Key
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
else:
    genai.configure(api_key=api_key)

    # 列出所有可用的 Gemma 模型代號
    print("可用的 Gemma 模型代號：")
    try:
        for m in genai.list_models():
            if "gemma" in m.name.lower():
                print(f"- {m.name} (Methods: {m.supported_generation_methods})")
    except Exception as e:
        print(f"Error: {str(e)}")
