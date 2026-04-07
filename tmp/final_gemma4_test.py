import os
import google.generativeai as genai
from dotenv import load_dotenv
import PIL.Image

load_dotenv()

def test_production_invoice():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    genai.configure(api_key=api_key)
    model_name = "models/gemma-4-26b-a4b-it"
    # 挑選 archive 中最大的一張圖
    img_path = r"C:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03\662248405_2461766334252978_8683255945996901395_n.jpg"
    
    print(f"--- Production Invoice Test: {model_name} ---")
    
    try:
        model = genai.GenerativeModel(model_name)
        if not os.path.exists(img_path):
            print(f"Error: {img_path} not found.")
            return

        img = PIL.Image.open(img_path)
        print("🔍檔案存在，送出辨識請求...")
        prompt = """這是一張 7-11 電子發票。
請提取以下資訊：
1. 店號（這通常是在條碼下方左側的 6 位數字，例如 229207）。
2. 店名（這通常位於發票最頂端，包含『門市』兩字）。

請直接回答：店號 - 店名"""
        
        response = model.generate_content([prompt, img])
        
        print("\n[辨識結果]")
        print(response.text)
        
    except Exception as e:
        print(f"\n[失敗] 模型辨識出錯：{str(e)}")

if __name__ == "__main__":
    test_production_invoice()
