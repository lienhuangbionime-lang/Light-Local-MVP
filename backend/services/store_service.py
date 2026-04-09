import asyncio
import json
import os
import re
import difflib
from typing import Optional, Dict, List
from backend.database.firebase import db
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
    
    # 支援多種可能的 stores.json 路徑
    POTENTIAL_JSON_PATHS = [
        os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "stores_cloud.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "stores.json"),
        "scripts/stores_cloud.json",
        "scripts/stores.json"
    ]
    
    json_path = next((p for p in POTENTIAL_JSON_PATHS if os.path.exists(p)), None)
    
    if not json_path:
        return
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            stores = json.load(f)
        
        _STORE_BY_ID.clear()
        _STORE_BY_NAME.clear()
        
        if isinstance(stores, dict):
            for sid, s in stores.items():
                name = s.get("name", "")
                if sid and name:
                    clean_name = re.sub(r'\s+', '', name)
                    _STORE_BY_ID[str(sid)] = s
                    _STORE_BY_NAME[clean_name] = str(sid)
        elif isinstance(stores, list):
            for s in stores:
                sid = str(s.get("id", ""))
                name = s.get("name", "")
                if sid and name:
                    clean_name = re.sub(r'\s+', '', name)
                    _STORE_BY_ID[sid] = s
                    _STORE_BY_NAME[clean_name] = sid
                    
    except Exception as e:
        print(f"[STORE] Failed to load store data: {e}")

def _fuzzy_find_store(clean_name: str) -> Optional[dict]:
    """高精度模糊搜尋：權衡匹配長度與相似度，解決 旗山 vs 旗山旗力 的誤判問題"""
    # 基礎清理
    core_name = re.sub(r'[^\w\u4e00-\u9fa5]', '', clean_name)
    core_name = re.sub(r'[門市分店店]', '', core_name)
    
    if not core_name: return None

    # 第一階段：嘗試精確匹配 (已去除空格版)
    if core_name in _STORE_BY_NAME:
        sid = _STORE_BY_NAME[core_name]
        return {**_STORE_BY_ID[sid], "id": sid}

    best_match = None
    best_score = 0.0
    best_match_len = 0
    
    # 第二階段：廣域比對並計分
    candidates = []
    
    for db_name, sid in _STORE_BY_NAME.items():
        db_name_core = re.sub(r'[門市分店店]', '', db_name)
        
        score = 0.0
        match_len = 0
        
        # 1. 包含關係 (包含愈長的名字權重愈高)
        # 例子：AI說「旗山旗力」 -> 資料庫「旗山旗力」 (4字) vs 「旗山」 (2字)
        if core_name in db_name_core:
            score = 0.9 + (len(core_name) / 100.0) # 基礎分 0.9，愈長愈好
            match_len = len(core_name)
        elif db_name_core in core_name:
            score = 0.8 + (len(db_name_core) / 100.0) # 基礎分 0.8，店名愈長(愈精確)愈好
            match_len = len(db_name_core)
            
        # 2. 地址加成
        store_address = _STORE_BY_ID[sid].get("address", "")
        clean_address = re.sub(r'[^\w\u4e00-\u9fa5]', '', store_address)
        if len(core_name) >= 6 and (core_name in clean_address or clean_address in core_name):
            score = 1.0 # 地址命中視為最高優先
            match_len = max(match_len, len(core_name))
            
        # 3. 相似度比對 (錯字處理)
        if score == 0:
            ratio = difflib.SequenceMatcher(None, core_name, db_name_core).ratio()
            if ratio >= 0.7:
                score = ratio
                match_len = len(db_name_core)

        if score >= 0.6:
            candidates.append({
                "match": {**_STORE_BY_ID[sid], "id": sid},
                "score": score,
                "length": match_len
            })

    if candidates:
        # 決勝關鍵：優先排序「匹配長度」(越精確的店名匹配長度越長)，次之看「分數」
        candidates.sort(key=lambda x: (x["length"], x["score"]), reverse=True)
        best_match = candidates[0]["match"]
        
    return best_match

async def resolve_store_info(raw_info: str, candidates: Optional[list] = None) -> str:
    """自動解析並轉換門市資訊 (AI+Python 協同增強版)"""
    _load_stores_into_memory()
    
    all_candidates = candidates or []
    if raw_info and raw_info not in all_candidates:
        all_candidates.insert(0, raw_info)
    
    # 過濾通用字
    BRAND_NOISE = {"7-ELEVEN", "7-11", "711", "7ELEVEN", "SEVEN ELEVEN"}
    all_candidates = [c for c in all_candidates if str(c).strip().upper() not in BRAND_NOISE]
    
    # 解析店號優先
    for c in all_candidates:
        c = str(c).strip()
        digit_id = re.search(r'\b\d{6}\b', c)
        if digit_id:
            sid = digit_id.group(0)
            if sid in _STORE_BY_ID:
                info = _STORE_BY_ID[sid]
                return f"{sid} {info.get('name', '')}"
                
    # 解析店名 (模糊匹配)
    for c in all_candidates:
        res = _fuzzy_find_store(str(c))
        if res:
            return f"{res['id']} {res.get('name', '')}"
            
    return raw_info # 真的沒辦法就回傳原句
