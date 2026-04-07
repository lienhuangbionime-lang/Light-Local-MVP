import os
import google.generativeai as genai
from dotenv import load_dotenv
import PIL.Image

load_dotenv()

def test_unbiased():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    genai.configure(api_key=api_key)
    model_name = "models/gemma-4-26b-a4b-it"
    # 換一張圖片
    img_path = r"C:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03\51a585b5-1fc1-458c-bba2-ee8c7cae976d.jpg"
    
    print(f"--- Unbiased Invoice Test: {model_name} ---")
    
    try:
        model = genai.GenerativeModel(model_name)
        if not os.path.exists(img_path):
            print(f"Error: {img_path} not found.")
            return

        img = PIL.Image.open(img_path)
        # 完全移除範例數字
        prompt = """請仔細閱讀這張 7-11 電子發票，並提取：
1. 店號（條碼附近或發票資訊欄中的 6 位數字）。
2. 店名（位於頂端或發票名稱處）。

直接回答：店號 - 店名"""
        
        print("🔍正在進行去偏見辨識...")
        response = model.generate_content([prompt, img])
        
        print("\n[最終辨識結果]")
        print(response.text)
        
    except Exception as e:
        print(f"\n[失敗] {str(e)}")

if __name__ == "__main__":
    test_unbiased()
