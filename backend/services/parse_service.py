import re
import json
from typing import Optional, List, Dict

# ─────────────────────────────────────────
# parse_service.py - Deterministic Regex Extractor
# 從 OCR 轉錄文字中，用確定性規則萃取 7-11 門市資訊
# 不依賴 AI 解讀，完全消滅幻覺
# ─────────────────────────────────────────

def extract_store_candidates_from_ocr(ocr_text: str) -> List[str]:
    """從 OCR 轉錄文字中，用 Regex 提取門市候選值
    
    規則：
    1. 精確 6 位數字 (不多不少) → 候選店號
    2. 排除年份 (民國年份 100-130, 西元年份 2000-2030)
    3. 排除已知發票號格式 (含英文字母的)
    """
    if not ocr_text:
        return []
    
    candidates = []
    
    # Rule 1: 找出所有獨立的 6 位數字（前後不能有其他數字）
    six_digit_matches = re.findall(r'(?<!\d)(\d{6})(?!\d)', ocr_text)
    
    # Rule 2: 排除年份範圍
    YEAR_RANGES = set(str(y) for y in range(100, 131))  # 民國年
    YEAR_RANGES.update(str(y) for y in range(2000, 2031))  # 西元年 (但這些是6位？不是)
    
    # Rule 3: 排除明確的月份格式 (如 "11101" → 111年01月 不是6位所以不會進來)
    for num in six_digit_matches:
        # 跳過看起來是年份的 (如 202401, 202312...)
        if re.match(r'^20(1[5-9]|2[0-9])\d{2}$', num):  # 2015xx - 2029xx 格式
            print(f"[PARSE] Skip year-like: {num}")
            continue
        candidates.append(num)
    
    print(f"[PARSE] OCR 萃取候選店號: {candidates}")
    return candidates


def extract_store_names_from_ocr(ocr_text: str, store_name_index: Dict[str, str]) -> List[str]:
    """從 OCR 文字中交叉比對已知門市名稱（記憶體索引）
    
    Args:
        ocr_text: OCR 轉錄的原始文字
        store_name_index: {店名: 店號} 的記憶體索引
    
    Returns:
        找到的有效店號列表
    """
    if not ocr_text or not store_name_index:
        return []
    
    found = []
    for store_name, store_id in store_name_index.items():
        if len(store_name) >= 2 and store_name in ocr_text:
            found.append(store_id)
            print(f"[PARSE] OCR 店名比對成功: '{store_name}' → {store_id}")
    
    return found


def extract_phone_from_ocr(ocr_text: str) -> Optional[str]:
    """從 OCR 文字中提取台灣手機號碼"""
    if not ocr_text:
        return None
    match = re.search(r'09\d{8}', ocr_text)
    return match.group(0) if match else None
