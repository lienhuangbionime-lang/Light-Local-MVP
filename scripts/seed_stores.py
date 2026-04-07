import asyncio
import os
import sys
import json
from dotenv import load_dotenv

# Add project root to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

# Explicitly load .env from root or backend/
load_dotenv(os.path.join(root_dir, ".env"))
load_dotenv(os.path.join(root_dir, "backend", ".env"))

from backend.database.firebase import db, init_firebase, sync_711_stores_from_cloud
from google.cloud.firestore_v1.vector import Vector
import backend.config as config

async def seed_stores():
    """將初始門市清單匯入 Firestore 並建立向量索引"""
    # 0. 初始化 Firebase (解決 Firestore not initialized 問題)
    init_firebase()
    
    print(f"Using API Key: {config.GEMINI_API_KEY[:5]}...{config.GEMINI_API_KEY[-5:] if config.GEMINI_API_KEY else 'NONE'}")
    
    if not db:
        print("Firestore initialization FAILED. Please check your credentials.")
        return

    json_path = os.path.join(os.path.dirname(__file__), "stores.json")
    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        stores = json.load(f)

    print(f"Processing {len(stores)} store records from JSON...")
    
    for store in stores:
        name = store["name"]
        store_id = store["id"]
        
        # 1. 檢查是否已存在 (避免重複上傳浪費額度)
        doc_ref = db.collection("stores_711").document(store_id)
        if doc_ref.get().exists:
            # print(f"Skipping {store_id} (already exists)") # 保持日誌乾淨
            continue

        # 2. 取得向量 (僅對新店執行)
        print(f"[*] Found NEW store: {store_id} ({name}). Generating vector...")
        vector = await get_gemini_embedding(name)
        
        if vector:
            # 3. 存入 Firestore
            doc_ref.set({
                "name": name,
                "address": store.get("address", ""),
                "name_vector": Vector(vector)
            })
            print(f"  [SAVED] {store_id}")
        else:
            print(f"Failed to get vector for {store_id}")

    # 3. 自動更新本地快取 (這會產生最新的 stores_cloud.json)
    print("\n[SUCCESS] Cloud sync complete. Triggering local cache update...")
    await sync_711_stores_from_cloud()
    print("[FINAL] All stores are now live and cached locally.")

if __name__ == "__main__":
    asyncio.run(seed_stores())
