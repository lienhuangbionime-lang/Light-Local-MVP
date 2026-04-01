import base64
import asyncio
import os
import sys

# Ensure backend can be imported
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

import backend.config as config
from backend.services.ai_service import ask_gemini_secretary

from backend.services.ai_service import ask_gemini_secretary
from backend.services.store_service import resolve_store_info

# 強制輸出為 UTF-8 以支援越南文/特殊字元顯示
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

async def test_vision():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    image_extensions = (".jpg", ".jpeg", ".png")
    test_images = [os.path.join(test_dir, f) for f in os.listdir(test_dir) if f.lower().endswith(image_extensions)]
    
    if not test_images:
        print(f"No images found in {test_dir}")
        return

    for image_path in test_images:
        print(f"\n--- Testing: {os.path.basename(image_path)} ---")
        
        with open(image_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode("utf-8")
        
        # 呼叫 AI 提取資訊
        result = await ask_gemini_secretary(
            text_content="辨識圖片中的 7-11 資訊", 
            image_data_base64=img_data,
            mime_type="image/jpeg"
        )
        
        if result:
            raw_shipping = result.get("shipping_info", "")
            inventory = result.get("numeric_inventory", "")
            # 💡 模擬後端的真實流程：呼叫 resolve_store_info 進行查表校正 (傳入救援清單)
            actual_shipping = await resolve_store_info(raw_shipping, inventory)
            
            print(f"Buyer Name: {result.get('buyer_name')}")
            print(f"Phone: {result.get('phone')}")
            print(f"AI Inventory: {result.get('numeric_inventory')}")
            print(f"Raw AI Extract: {raw_shipping}")
            print(f"Final Resolved: {actual_shipping}")
        else:
            print("Result: Failed to parse.")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(test_vision())
