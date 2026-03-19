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

from backend.database.firebase import db
from backend.services.ai_service import get_gemini_embedding
from google.cloud.firestore_v1.vector import Vector
import backend.config as config

async def seed_stores():
    """將初始門市清單匯入 Firestore 並建立向量索引"""
    print(f"Using API Key: {config.GEMINI_API_KEY[:5]}...{config.GEMINI_API_KEY[-5:] if config.GEMINI_API_KEY else 'NONE'}")
    
    if not db:
        print("Firestore not initialized")
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
        
        # 1. 取得向量
        print(f"Generating vector for '{store_id}' ({name})...")
        vector = await get_gemini_embedding(name)
        
        if vector:
            # 2. 存入 Firestore
            doc_ref = db.collection("stores_711").document(store_id)
            doc_ref.set({
                "name": name,
                "address": store.get("address", ""),
                "name_vector": Vector(vector)
            })
            print(f"Saved: {store_id}")
        else:
            print(f"Failed to get vector for {store_id}")

if __name__ == "__main__":
    asyncio.run(seed_stores())
