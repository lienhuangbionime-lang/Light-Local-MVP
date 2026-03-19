import os
import base64
import asyncio
import sys
import json

# Adjust path to import backend modules
sys.path.insert(0, os.path.abspath("."))

from backend.services.ai_service import ask_gemini_secretary

async def test_extraction(image_path):
    with open(image_path, "rb") as f:
        img_data = base64.b64encode(f.read()).decode("utf-8")
    
    prompt = """你現在是「EchoOrder 結帳小幫手」。你的任務是從圖片中提取買家資訊。
圖片內容可能包含：
- 7-11 門市選擇完成的截圖（含有門市名稱、店號）
- 對話截圖
- 寄件單據

請【嚴格】回傳以下 JSON 格式，不要包含任何開場白或解釋：
{
  "buyer_name": "提取到的姓名 (若無則留空)",
  "phone": "提取到的電話 (格式 09xxxxxxxx)",
  "shipping_info": "提取到的 7-11 門市名稱與 6 碼店號"
}"""

    print(f"Testing image: {image_path}")
    result = await ask_gemini_secretary(text_content="[USER TEST]", image_data_base64=img_data, system_prompt=prompt)
    print("Result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    # We will pass the image path as the first argument
    if len(sys.argv) > 1:
        asyncio.run(test_extraction(sys.argv[1]))
    else:
        print("Please provide image path")
