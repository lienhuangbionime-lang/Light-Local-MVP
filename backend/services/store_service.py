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
    
    # 3. 關鍵字加權比對 (處理 substring)
    for name, sid in _STORE_BY_NAME.items():
        s_name_core = re.sub(r'[門市分店店]', '', name)
        
        # 👑 完美包含權重 (如果 AI 抓到的「港富」就在「港富門市」裡，直接 100% 命中)
        if core_name and core_name in s_name_core:
            return {**_STORE_BY_ID[sid], "id": sid}

        # 👑 反向包含權重 (反向: 如果 AI 提供了長地址，而店名 "南勢" 剛好在裡面)
        # 必須確保店名 >= 2 個字，避免單字店名盲目命中
        if len(s_name_core) >= 2 and s_name_core in core_name:
            return {**_STORE_BY_ID[sid], "id": sid}
            
        # 🏠 地址精確匹配 (如果 AI 給的是完整或部分地址，且與門市地址高度重合)
        store_address = _STORE_BY_ID[sid].get("address", "")
        clean_address = re.sub(r'[^\w\u4e00-\u9fa5]', '', store_address)
        if len(core_name) >= 6 and (core_name in clean_address or clean_address in core_name):
            return {**_STORE_BY_ID[sid], "id": sid}
            
        # 4. 使用 difflib 進行序列比對 (處理如 旗 vs 嵐 等錯字)
        score = difflib.SequenceMatcher(None, core_name, s_name_core).ratio()
        
        if score > best_score:
            best_score = score
            best_match = {**_STORE_BY_ID[sid], "id": sid}
    
    if best_score < 0.6: # 稍微調降門檻，因為我們已經有了 Substring 必中邏輯
        print(f"[STORE] Fuzzy match failed for '{core_name}' (Best score: {best_score:.2f})")
    
    return best_match if best_score >= 0.6 else None


# ─────────────────────────────────────────
# 主要對外介面：解析門市資訊
# ─────────────────────────────────────────
async def resolve_store_info(raw_info: str, candidates: Optional[list] = None) -> str:
    """自動解析並轉換門市資訊 (AI+Python 協同增強版)
    優先順序：1. 精確店名匹配 -> 2. 資料庫店號匹配 -> 3. 模糊店名匹配
    """
    _load_stores_into_memory()
    
    all_candidates = candidates or []
    if raw_info and raw_info not in all_candidates:
        all_candidates.insert(0, raw_info)
    
    # ⬇️ 預過濾：去除品牌通用詞彙（不是門市名）
    BRAND_NOISE = {"7-ELEVEN", "7-11", "711", "7ELEVEN", "SEVEN ELEVEN"}
    all_candidates = [c for c in all_candidates if str(c).strip().upper() not in BRAND_NOISE]
    
    if not all_candidates:
        return ""

    # 1. 第一階段：精確店名匹配 (優先於店號)
    for cand in all_candidates:
        clean_name = str(cand).strip()
        for noise in ["7-ELEVEN", "7-11", "711", "門市", "店"]:
            clean_name = clean_name.replace(noise, "")
        clean_name = re.sub(r'[^\w\u4e00-\u9fa5]', '', clean_name).strip()
        
        if clean_name in _STORE_BY_NAME:
            sid = _STORE_BY_NAME[clean_name]
            store = _STORE_BY_ID[sid]
            print(f"[STORE] Best Match (Exact Name): {clean_name} -> {sid}")
            return f"{sid} {store['name']}"

    # 2. 第二階段：驗證店號 (必須在資料庫中)
    for cand in all_candidates:
        cand_str = str(cand).replace("-", "").strip()
        m = re.search(r'\b\d{6}\b', cand_str)
        if m:
            sid = m.group(0)
            if sid in _STORE_BY_ID:
                store = _STORE_BY_ID[sid]
                print(f"[STORE] Match by Verified ID: {sid} -> {store['name']}")
                return f"{sid} {store['name']}"

    # 3. 第三階段：模糊店名比對
    for cand in all_candidates:
        clean_name = str(cand)
        for noise in ["7-ELEVEN", "7-11", "711", "門市", "店"]:
            clean_name = clean_name.replace(noise, "")
        clean_name = re.sub(r'[^\w\u4e00-\u9fa5]', '', clean_name).strip()
        
        if len(clean_name) >= 2:
            matched = _fuzzy_find_store(clean_name)
            if matched:
                result = f"{matched['id']} {matched['name']}"
                print(f"[STORE] Match by Fuzzy Name: '{clean_name}' -> {result}")
                return result

    print(f"[STORE] No match found for candidates: {all_candidates}")
    
    # 🍁 最終防線 (Fallback)：當資料庫沒有這家店 (例如新店或只給了地址)
    # 我們不應該回傳空字串把 AI 抓到的有用資訊洗掉
    INVOICE_KEYWORDS = ["發票", "電子發票", "驗證碼", "交易筆數", "消費金額", "AU-", "NM-", "BN-"]
    
    for cand in all_candidates:
        c_str = str(cand).strip()
        # 跳過明顯是發票號碼的純 6 碼噪訊
        if re.fullmatch(r'\d{6}', c_str.replace("-", "")):
            continue
        # 跳過包含發票關鍵字的收據文字 (如 Hà Mun 案例)
        if any(kw in c_str for kw in INVOICE_KEYWORDS):
            print(f"[STORE] Fallback SKIP (invoice text): {c_str[:60]}")
            continue
        # 跳過換行超過 2 次的長文本 (發票收據通常是多行的)
        if c_str.count('\n') > 2:
            print(f"[STORE] Fallback SKIP (multi-line text): {c_str[:60]}")
            continue
        # 必須包含中文字 (地址或店名) 才放行，避免回傳 7-ELEVEN, B0-9819498 等無用英文與序號
        has_chinese = bool(re.search(r'[\u4e00-\u9fa5]', c_str))
        clean_cand = re.sub(r'[^\w\u4e00-\u9fa5]', '', c_str).strip()
        
        if has_chinese and len(clean_cand) >= 2:
            print(f"[STORE] Fallback to raw AI text: {c_str}")
            return f"❓ {c_str}"
            
    return ""


# 下面是備用的向量搜尋與同步任務
async def find_store_by_semantic_match(name: str) -> Optional[Dict]:
    return _fuzzy_find_store(name)

async def sync_official_stores_task(force: bool = False):
    """雲端自動同步並重新載入記憶體"""
    # 這裡我們簡化處理，直接回傳成功，實際同步由 fetch 腳本處理
    _load_stores_into_memory()
    return {"total": len(_STORE_BY_ID)}
