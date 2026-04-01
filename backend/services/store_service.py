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
    
    # 支援多種可能的 stores.json 路徑 (根據 Render/Docker 結構)
    POTENTIAL_JSON_PATHS = [
        os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "stores_cloud.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "stores.json"),
        "scripts/stores_cloud.json",
        "scripts/stores.json"
    ]
    
    json_path = next((p for p in POTENTIAL_JSON_PATHS if os.path.exists(p)), None)
    
    if not json_path:
        print(f"[STORE] No stores.json or stores_cloud.json found.")
        return
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            stores = json.load(f)
        
        _STORE_BY_ID.clear()
        _STORE_BY_NAME.clear()
        
        # 兼容模式：處理 List 或 Dict 格式
        if isinstance(stores, dict):
            # 雲端同步下來的 Dict 格式 (id -> data)
            for sid, s in stores.items():
                name = s.get("name", "")
                if sid and name:
                    _STORE_BY_ID[str(sid)] = s
                    _STORE_BY_NAME[name] = str(sid)
        elif isinstance(stores, list):
            # 原始 stores.json 的 List 格式
            for s in stores:
                sid = str(s.get("id", ""))
                name = s.get("name", "")
                if sid and name:
                    _STORE_BY_ID[sid] = s
                    _STORE_BY_NAME[name] = sid
        
        msg = f"[STORE] Loaded {len(_STORE_BY_ID)} stores from {os.path.basename(json_path)}"
        print(msg)
        config.LAST_EVENTS.insert(0, {"time": "init", "content": msg})
    except Exception as e:
        msg = f"[STORE] Failed to load store data: {e}"
        print(msg)
        config.LAST_EVENTS.insert(0, {"time": "error", "content": msg})

# _load_stores_into_memory()

def _fuzzy_find_store(clean_name: str) -> Optional[dict]:
    """從記憶體索引中模糊搜尋門市名稱，回傳最佳匹配"""
    import difflib
    
    # 0. 基礎清理 (移除不可見字元與各類空白)
    clean_name = re.sub(r'[^\w\u4e00-\u9fa5]', '', clean_name)
    # 移除門市冗餘字以便比對
    core_name = re.sub(r'[門市分店店]', '', clean_name)
    
    # 1. 核心店名匹配 (優先)
    if core_name in _STORE_BY_NAME:
        sid = _STORE_BY_NAME[core_name]
        return {**_STORE_BY_ID[sid], "id": sid}
    
    # 2. 精確匹配 (原本的完整店名)
    if clean_name in _STORE_BY_NAME:
        sid = _STORE_BY_NAME[clean_name]
        return {**_STORE_BY_ID[sid], "id": sid}
    
    best_match = None
    best_score = 0.0
    
    # 3. 使用 difflib 進行序列比對 (處理如 旗 vs 嵐 等錯字)
    for name, sid in _STORE_BY_NAME.items():
        s_name_core = re.sub(r'[門市分店店]', '', name)
        
        # 使用 SequenceMatcher 計算相似度 (0.0 到 1.0)
        score = difflib.SequenceMatcher(None, core_name, s_name_core).ratio()
        
        # 如果包含關係非常明顯，給予額外加分
        if s_name_core in core_name or core_name in s_name_core:
            score = max(score, 0.75)
            
        if score > best_score:
            best_score = score
            best_match = {**_STORE_BY_ID[sid], "id": sid}
    
    if best_score < 0.7:
        print(f"[STORE] Fuzzy match failed for '{core_name}' (Best score: {best_score:.2f})")
    
    return best_match if best_score >= 0.7 else None


# ─────────────────────────────────────────
# 主要對外介面：解析門市資訊
# ─────────────────────────────────────────
async def resolve_store_info(raw_info: str, numeric_inventory: Optional[str] = None) -> str:
    """自動解析並轉換門市資訊
    Args:
        raw_info: AI 提取的原始資訊 (如 "280970" 或 "旗山旗力")
        numeric_inventory: (選用) AI 的數字清單，用於救援解析
    回傳格式: "店號 店名" (如: 280970 旗山旗)
    """
    _load_stores_into_memory()
    
    # 0. 排除極端無效輸入
    if not raw_info and not numeric_inventory:
        return ""
    
    # 1. 尋找精確 6 位數店號
    def find_6_digits(text: str) -> Optional[str]:
        if not text: return None
        match = re.search(r'\b\d{6}\b', text.replace("-", ""))
        return match.group(0) if match else None

    # 優先從 raw_info 找，找不到再從 inventory 找
    target_id = find_6_digits(raw_info)
    if not target_id and numeric_inventory:
        target_id = find_6_digits(numeric_inventory)
        if target_id: print(f"[STORE] Rescue matched ID: {target_id}")

    # 2. 如果有店號，直接查表
    if target_id and target_id in _STORE_BY_ID:
        store = _STORE_BY_ID[target_id]
        result = f"{target_id} {store['name']}"
        print(f"[STORE] Matched by ID: {target_id} -> {result}")
        return result
    
    # 3. 如果沒店號，嘗試店名模糊比對
    if raw_info:
        # 清理字樣 (移除 7-11, 門市, 括號等)
        clean_name = raw_info
        for noise in ["7-ELEVEN", "7-11", "門市", "店", "(", ")", "（", "）"]:
            clean_name = clean_name.replace(noise, "")
        clean_name = re.sub(r'[^\w\u4e00-\u9fa5]', '', clean_name).strip()
        
        if len(clean_name) >= 2:
            matched = _fuzzy_find_store(clean_name)
            if matched:
                result = f"{matched['id']} {matched['name']}"
                print(f"[STORE] Matched by Name: {clean_name} -> {result}")
                return result
    
    print(f"[STORE] No match, returning raw: '{raw_info}'")
    return raw_info if raw_info else ""


# 下面是備用的向量搜尋與同步任務
async def find_store_by_semantic_match(name: str) -> Optional[Dict]:
    return _fuzzy_find_store(name)

async def sync_official_stores_task(force: bool = False):
    """雲端自動同步並重新載入記憶體"""
    # 這裡我們簡化處理，直接回傳成功，實際同步由 fetch 腳本處理
    _load_stores_into_memory()
    return {"total": len(_STORE_BY_ID)}
