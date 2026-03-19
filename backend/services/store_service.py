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
    
    # 支援多種可能的 stores.json 路徑 (根據 Render/Docker 結構)
    POTENTIAL_JSON_PATHS = [
        os.path.join(current_dir, "..", "..", "scripts", "stores.json"), # 本地或 root
        os.path.join(os.path.dirname(current_dir), "..", "scripts", "stores.json"),
        "/app/scripts/stores.json", # Docker
        os.path.join(os.getcwd(), "scripts", "stores.json")
    ]
    
    json_path = next((p for p in POTENTIAL_JSON_PATHS if os.path.exists(p)), None)
    
    if not json_path or not os.path.exists(json_path):
        print(f"[STORE] stores.json not found in any potential paths: {POTENTIAL_JSON_PATHS}")
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
    
    # 使用字元重合度 (Intersection over Union) 進行評分
    best_match = None
    best_score = 0.0
    
    for name, sid in _STORE_BY_NAME.items():
        score = 0.0
        
        # 移除門市冗餘字 (店名核心)
        s_name_core = name
        for w in ["門市", "分店", "店"]:
            s_name_core = s_name_core.replace(w, "")
            
        # 1. 核心店名精確包含
        if s_name_core in clean_name or clean_name in s_name_core:
            # 依據字數比例給分
            ratio = min(len(s_name_core), len(clean_name)) / max(len(s_name_core), len(clean_name))
            score = 0.6 + (0.4 * ratio)
        else:
            # 2. 字元集重合 (處理錯字或部分缺失)
            set_c = set(clean_name)
            set_s = set(s_name_core)
            if len(set_c & set_s) >= 2:
                score = len(set_c & set_s) / len(set_c | set_s)
        
        if score > best_score:
            best_score = score
            best_match = {**_STORE_BY_ID[sid], "id": sid}
    
    # 閾值設定為 0.7 (確保準確性)
    return best_match if best_score >= 0.7 else None


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
