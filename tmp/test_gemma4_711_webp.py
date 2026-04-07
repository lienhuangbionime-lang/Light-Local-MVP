import os
import google.generativeai as genai
from dotenv import load_dotenv
import PIL.Image

load_dotenv()

def test_711_webp():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    genai.configure(api_key=api_key)
    model_name = "models/gemma-4-26b-a4b-it"
    img_path = r"C:\Users\lien.huang\.gemini\antigravity\brain\2584330b-7354-4a4b-81b2-db63aa9c2f53\711_emap_search_1775245130783.webp"
    
    print(f"--- 711 WebP Test: {model_name} ---")
    
    try:
        model = genai.GenerativeModel(model_name)
        if not os.path.exists(img_path):
            print(f"Error: {img_path} not found.")
            return

        img = PIL.Image.open(img_path)
        print("🔍正在進行 7-11 門市資料全解析...")
        response = model.generate_content(["請列出這張圖片中看到的所有 7-11 門市店號和店名。格式：店號 - 店名", img])
        
        print("\n[辨識結果：全部內容]")
        print(response.text)
        
    except Exception as e:
        print(f"\n[失敗] 模型辨識出錯：{str(e)}")

if __name__ == "__main__":
    test_711_webp()
