import requests
import base64
import json
import os

def test_live_ocr():
    # 測試本地 3000 埠 (Next.js) 的 OCR 路由
    url = "http://localhost:3000/api/ocr"
    img_path = r"C:\Users\lien.huang\.gemini\antigravity\brain\2674ef86-91b2-421a-aad4-35971c4ec596\media__1773782503386.jpg"
    
    if not os.path.exists(img_path):
        print(f"Image not found: {img_path}")
        return

    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, json={"imageBase64": img_b64}, timeout=60)
        print(f"Status Code: {response.status_code}")
        print("Response Body:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_live_ocr()
