import asyncio
import json
import os
import re
from typing import Optional, Dict
from google.cloud.firestore_v1.vector import Vector
from backend.database.firebase import db
from backend.services.ai_service import get_gemini_embedding
import backend.config as config
import httpx
from bs4 import BeautifulSoup

# ─────────────────────────────────────────
# 記憶體門市索引 (啟動時載入，查詢 O(1))
# ─────────────────────────────────────────
_STORE_BY_ID: Dict[str, dict] = {}    # { "280970": {"name": "旗山旗力", "address": ...} }
_STORE_BY_NAME: Dict[str, str] = {}   # { "旗山旗力": "280970" }

def _load_stores_into_memory():
    """從 stores.json 載入門市資料到記憶體"""
    global _STORE_BY_ID, _STORE_BY_NAME
    # 這裡使用絕對路徑以確保在任何環境都能讀到
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, "..", "..", "scripts", "stores.json")
    json_path = os.path.normpath(json_path)
    
    if not os.path.exists(json_path):
        print(f"[STORE] stores.json not found at {json_path}")
        return
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            stores = json.load(f)
        
        _STORE_BY_ID.clear()
        _STORE_BY_NAME.clear()
        for s in stores:
            sid = str(s.get("id", ""))
            name = s.get("name", "")
            if sid and name:
                _STORE_BY_ID[sid] = s
                _STORE_BY_NAME[name] = sid
        
        msg = f"[STORE] Loaded {len(_STORE_BY_ID)} stores into memory"
        print(msg)
        config.LAST_EVENTS.insert(0, {"time": "init", "content": msg})
    except Exception as e:
        msg = f"[STORE] Failed to load stores.json: {e}"
        print(msg)
        config.LAST_EVENTS.insert(0, {"time": "error", "content": msg})

# Removed module-level call to prevent hangs during import
# _load_stores_into_memory()


def _fuzzy_find_store(clean_name: str) -> Optional[dict]:
    """從記憶體索引中模糊搜尋門市名稱，回傳最佳匹配"""
    if not clean_name or not _STORE_BY_NAME:
        return None
    
    # 1. 精確匹配
    if clean_name in _STORE_BY_NAME:
        sid = _STORE_BY_NAME[clean_name]
        return {**_STORE_BY_ID[sid], "id": sid}
    
    # 2. 包含匹配 (如 "旗山旗力" 包含 "旗山旗")
    best_match = None
    best_score = 0.0
    
    for name, sid in _STORE_BY_NAME.items():
        score = 0.0
        
        # 如果輸入的名稱包含資料庫的名字 (處理 Ibon 截斷)
        if name in clean_name:
            score = 0.5 + len(name) / len(clean_name)
        elif clean_name in name:
            score = 0.4 + len(clean_name) / len(name)
        else:
            # 簡單的相關性權重
            common_chars = set(clean_name) & set(name)
            if common_chars:
                score = len(common_chars) / max(len(clean_name), len(name))
        
        if score > best_score:
            best_score = score
            best_match = {**_STORE_BY_ID[sid], "id": sid}
    
    # 閾值設定為 0.4
    return best_match if best_score >= 0.4 else None


# ─────────────────────────────────────────
# 主要對外介面：解析門市資訊
# ─────────────────────────────────────────
async def resolve_store_info(raw_info: str) -> str:
    """自動解析並轉換門市資訊
    回傳格式: "店號 店名" (如: 280970 旗山旗力)
    """
    if not raw_info:
        return raw_info
    
    print(f"[STORE] Resolving: '{raw_info}'")
    
    # 必要時重新載入
    if not _STORE_BY_ID:
        _load_stores_into_memory()
    
    # 1. 已有 6 碼數字 → 直接查記憶體
    id_match = re.search(r'\d{6}', raw_info)
    if id_match:
        store_id = id_match.group(0)
        store = _STORE_BY_ID.get(store_id)
        if store:
            return f"{store_id} {store.get('name', '')}"
        return store_id
    
    # 2. 清理店名
    clean_name = raw_info
    for remove_word in ["7-ELEVEN", "7-11", "7ELEVEN", "SEVEN ELEVEN", "門市", "分店", "店", "(", ")", "（", "）", " "]:
        clean_name = clean_name.replace(remove_word, "")
    clean_name = clean_name.strip()
    
    if clean_name and len(clean_name) >= 2:
        # 3. 記憶體模糊搜尋
        matched = _fuzzy_find_store(clean_name)
        if matched:
            result = f"{matched['id']} {matched.get('name', '')}"
            print(f"[STORE] Matched: {raw_info} -> {result}")
            return result
    
    print(f"[STORE] No match, returning raw: '{raw_info}'")
    return raw_info


# 下面是備用的向量搜尋與同步任務
async def find_store_by_semantic_match(name: str) -> Optional[Dict]:
    return _fuzzy_find_store(name)

async def sync_official_stores_task(force: bool = False):
    """雲端自動同步並重新載入記憶體"""
    # 這裡我們簡化處理，直接回傳成功，實際同步由 fetch 腳本處理
    _load_stores_into_memory()
    return {"total": len(_STORE_BY_ID)}
