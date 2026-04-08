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

def _normalize_store_name(name: str) -> str:
    """極致標準化：處理簡繁、錯別字、全半形"""
    # 1. 移除所有非字元 (含空白、符號)
    name = re.sub(r'[^\w\u4e00-\u9fa5]', '', name)
    # 2. 移除冗餘字彙
    name = re.sub(r'[門市分店店]', '', name)
    # 3. [GLOBAL FIX] 處理常見錯別字或特定地區別名
    FIXES = {
        "旗力": "旗山旗",
        "旗力旗山": "旗山旗",
        "旗山旗力": "旗山旗",
        "嵐山": "旗山"
    }
    for src, dst in FIXES.items():
        if src in name:
            name = name.replace(src, dst)
    return name

def _fuzzy_find_store(raw_name: str) -> Optional[dict]:
    """從記憶體索引中模糊搜尋門市名稱，回傳最佳匹配"""
    import difflib
    
    core_name = _normalize_store_name(raw_name)
    if not core_name: return None
    
    # 1. 核心店名匹配 (優先)
    if not hasattr(_fuzzy_find_store, "_norm_index"):
        _fuzzy_find_store._norm_index = { _normalize_store_name(n): sid for n, sid in _STORE_BY_NAME.items() }
    
    if core_name in _fuzzy_find_store._norm_index:
        sid = _fuzzy_find_store._norm_index[core_name]
        return {**_STORE_BY_ID[sid], "id": sid}
    
    # 2. 關鍵字加權比對
    best_match = None
    best_score = 0.0
    
    for norm_name, sid in _fuzzy_find_store._norm_index.items():
        if len(core_name) >= 2 and (core_name in norm_name or norm_name in core_name):
            score = 0.9 + (min(len(core_name), len(norm_name)) / max(len(core_name), len(norm_name)) * 0.1)
            if score > best_score:
                best_score = score
                best_match = {**_STORE_BY_ID[sid], "id": sid}

    # 3. 使用 difflib (最後手段)
    if not best_match:
        for norm_name, sid in _fuzzy_find_store._norm_index.items():
            score = difflib.SequenceMatcher(None, core_name, norm_name).ratio()
            if score > best_score:
                best_score = score
                best_match = {**_STORE_BY_ID[sid], "id": sid}
    
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
    
    # [MANUAL ALIAS] 處理特定的地名縮寫或門市別名
    STORE_ALIASES = {
        "旗山旗力": "280970",
        "旗力旗山": "280970",
        "旗力": "280970"
    }
    
    # 優先檢查手動別名
    for cand in all_candidates:
        c_str = str(cand).strip()
        if c_str in STORE_ALIASES:
            sid = STORE_ALIASES[c_str]
            if sid in _STORE_BY_ID:
                store = _STORE_BY_ID[sid]
                print(f"[STORE] Alias Match: {c_str} -> {sid}")
                return f"{sid} {store['name']}"

    # ⬇️ 預過濾：去除品牌通用詞彙（不是門市名）
    BRAND_NOISE = {"7-ELEVEN", "7-11", "711", "7ELEVEN", "SEVEN ELEVEN"}
    all_candidates = [c for c in all_candidates if str(c).strip().upper() not in BRAND_NOISE]
    
    # ⬇️ 嚴格規則：純數字的候選值必須剛好 6 位，否則捨棄
    # (例如 "04983860"=8位, "324"=3位 → 全部捨棄，但含中文的地址不受此限)
    def _is_valid_candidate(c: str) -> bool:
        c = str(c).strip()
        digits_only = re.sub(r'\D', '', c)  # 取出所有數字
        if c.isdigit():  # 純數字
            return len(c) == 6  # 必須剛好6位
        return True  # 含其他字元 (中文地址、店名等) → 保留
    
    all_candidates = [c for c in all_candidates if _is_valid_candidate(str(c))]
    
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
