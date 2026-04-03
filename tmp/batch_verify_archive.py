import os
import asyncio
import base64
import json
import re
import sys

# 注入 backend 路徑以確保 import 正常
sys.path.append(os.getcwd())

from backend.services.ai_service import ask_gemini_secretary
from backend.services.store_service import resolve_store_info

ARCHIVE_DIR = r"c:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03"

async def test_image(image_path):
    print(f"\n[TEST] 處理圖片: {os.path.basename(image_path)}")
    
    # 1. 讀取與轉 Base64
    with open(image_path, "rb") as f:
        img_base64 = base64.b64encode(f.read()).decode("utf-8")
    
    # 2. 呼叫 AI 提取初步資料
    # 我們不提供歷史紀錄，純看圖
    result = await ask_gemini_secretary("請辨識圖中收件資訊", image_data_base64=img_base64)
    
    if not result:
        print("[-] AI 解析失敗")
        return

    print(f"[AI Raw] {json.dumps(result, ensure_ascii=False)}")
    
    # 3. 提取 6 位數候選者 (模仿 main.py 的邏輯)
    candidates = []
    # 從 shipping_info 提取
    raw_info = result.get("shipping_info", "")
    candidates.extend(re.findall(r'\d{6}', str(raw_info)))
    
    # 也從整個 JSON 字串提取，防止 AI 把店號放在 reasoning
    all_text = json.dumps(result)
    candidates.extend(re.findall(r'\d{6}', all_text))
    
    # 去重
    candidates = list(set(candidates))
    print(f"[Candidates] {candidates}")

    # 4. 協同驗證 (Synergy)
    # resolve_store_info 會處理優先級與 DB 比對
    verified_store = await resolve_store_info("", candidates=candidates)
    print(f"[Result] 最終辨識結果: '{verified_store}'")

async def main():
    if not os.path.exists(ARCHIVE_DIR):
        print(f"錯誤: 找不到目錄 {ARCHIVE_DIR}")
        return

    images = [f for f in os.listdir(ARCHIVE_DIR) if f.lower().endswith(".jpg")]
    print(f"共找到 {len(images)} 張測試圖片。")

    for img in images:
        await test_image(os.path.join(ARCHIVE_DIR, img))

if __name__ == "__main__":
    asyncio.run(main())
