import re
import json
import os
import hashlib
import asyncio
from typing import Optional, Dict, Any, List
from backend.config import ACTIVE_PRODUCTS, global_client
import backend.config as config

# Delete duplicate helper added in previous step

async def get_gemini_embedding(text: str) -> Optional[List[float]]:
    """呼叫 Google AI Studio API 取得文字向量 (Embedding)
    使用最新的 gemini-embedding-2-preview 模型，並強制 768 維度以相容 Firestore
    """
    if not config.GEMINI_API_KEY:
        return None
    
    # 使用 config 中的模型設定
    model_name = config.GEMINI_EMBEDDING_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:embedContent?key={config.GEMINI_API_KEY}"
    
    payload = {
        "model": model_name,
        "content": {"parts": [{"text": text}]},
        "output_dimensionality": 768  # 強制對齊 Firestore 索引常用維度 (768)
    }
    
    try:
        res = await global_client.post(url, json=payload, timeout=10.0)
        if res.status_code == 200:
            return res.json().get("embedding", {}).get("values")
        else:
            print(f"[AI] Embedding 請求失敗 ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"[AI] Embedding 呼叫異常: {e}")
    return None

async def call_ai_studio(model_name: str, contents: List[Dict], system_instruction: Optional[str] = None) -> Optional[str]:
    """通用 Google AI Studio API 呼叫函式
    支援 system_instruction 以防止模型鏡像 (Mirroring) 系統指令
    """
    if not config.GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={config.GEMINI_API_KEY}"
    payload: Dict[str, Any] = {"contents": contents}
    if system_instruction:
        # 將系統指令直接注入第一個內容的最前方
        if contents and "parts" in contents[0]:
            contents[0]["parts"].insert(0, {"text": f"SYSTEM_INSTRUCTION:\n{system_instruction}\n\n---"})
            
    try:
        res = await global_client.post(url, json=payload, timeout=60.0)
        if res.status_code == 200:
            raw_res = res.json()
            candidates = raw_res.get("candidates", [])
            if not candidates:
                return None
            
            # 遍歷所有 parts 找尋文字 (避免被 thought 或空 part 擋住)
            parts = candidates[0].get("content", {}).get("parts", [])
            full_text = ""
            for p in parts:
                if "text" in p:
                    full_text += p["text"]
            
            if not full_text:
                return None
                
            return full_text
        else:
            print(f"[AI] {model_name} 請求失敗 ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"[AI] {model_name} 呼叫異常: {e}")
    return None

async def transcribe_image_text(image_data_base64: str, mime_type: str = "image/jpeg") -> Optional[str]:
    """Step 1 of two-step OCR: 請 AI 一字不漏地把圖中所有文字轉錄為純文字
    不做任何解讀，只做文字轉錄，提供給 parse_service.py 做 Regex 萃取
    """
    if not config.GEMINI_API_KEY or not image_data_base64:
        return None
    
    ocr_prompt = "請把這張圖片中所有可見的文字，一字不漏地轉錄為純文字。不要翻譯、不要解釋、不要加任何說明，只輸出原始文字內容。"
    
    parts = [
        {"text": ocr_prompt},
        {"inline_data": {"mime_type": mime_type, "data": image_data_base64}}
    ]
    
    pure_model = config.GEMINI_VISION_MODEL.replace("models/", "")
    raw_text = await call_ai_studio(pure_model, [{"parts": parts}])
    print(f"[OCR] 轉錄完成，共 {len(raw_text) if raw_text else 0} 字元")
    return raw_text

def load_ai_knowledge_base() -> str:
    """從 sync_brain 讀取最新的 FAQ 知識庫內容"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # backend/
    
    POTENTIAL_PATHS = [
        os.path.join(base_dir, "sync_brain", "KNOWLEDGE_BASE.md"), # backend/sync_brain/
        os.path.join(os.path.dirname(base_dir), "sync_brain", "KNOWLEDGE_BASE.md"), # root/sync_brain/
        os.path.join(os.getcwd(), "sync_brain", "KNOWLEDGE_BASE.md") # current_dir/sync_brain/
    ]
    
    target_path = next((p for p in POTENTIAL_PATHS if os.path.exists(p)), None)
    
    if target_path:
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"[AI] 讀取知識庫失敗: {e}")
    return "尚無外部知識庫資料。"

async def ask_gemma_receptionist(text_content: str) -> Optional[Dict[str, Any]]:
    """使用 Gemma 4 31B IT 進行初步診斷與 FAQ 回覆 (接待員角色)"""
    kb_content = load_ai_knowledge_base()
    
    system_prompt = f"""
你是一位專業且親切的「FB直播櫃檯接待員 (Gemma)」。
你的任務是讀取買家留言，並根據下方的【商店知識庫】提供回覆或決定是否轉交主管。

【商店知識庫】：
{kb_content}

【處理邏輯】：
1. **FAQ 回覆**: 若買家詢問運費、付款、活動等，請從知識庫中提取答案。
2. **訂單偵測**: 若買家輸入「代號+數量」(如 A+1)，請標註 "is_order": true。
3. **疑難排解**: 若買家提到收不到訊息，請參考知識庫中的「疑難排除」引導。
4. **提升價值**: 即使留言很簡單，也請給予溫暖的回覆，讓買家感受到尊榮。
5. **轉交主管**: 若買家傳送圖片、地圖、或需要進行「扣庫存/改單」等精確物流操作，請標註 "escalate": true。

【回傳任務 (JSON 格式)】：
{{
  "answer": "給買家的回覆 (如果是 A+1，回覆：『已收到 A 的訂購意願，主管稍後為您確認！』)",
  "is_order": false,
  "escalate": false,
  "intent": "詢問運費/下單/哈拉/抱怨",
  "recommended_action": "給工作人員的建議步驟"
}}
"""
    contents = [{"parts": [{"text": f"買家留言：\n{text_content}"}]}]
    text_out = await call_ai_studio(config.GEMINI_VISION_MODEL, contents, system_instruction=system_prompt) 
    
    if text_out:
        json_match = re.search(r'\{.*\}', text_out, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except: pass
    return None

def clean_json_output(text: str) -> str:
    """
    提升 JSON 萃取穩定性。優先尋找包含買家資訊關鍵字的區塊，避開 AI 的導讀廢話或指令覆讀。
    """
    if not text:
        return ""
    
    # 1. 優先尋找「真正的」資料 JSON 區塊 (開頭必須是 {" 且包含 buyer_name)
    # 使用 [^{]* 確保抓到的是最內層或最貼近關鍵字的左大括號
    data_match = re.search(r'(\{[^{]*?"buyer_name"[\s\S]*?\})', text)
    if data_match:
        return data_match.group(1).strip()
        
    # 2. 備案：尋找任何包含 "buyer_name" 的大括號區塊 (較寬鬆)
    wider_match = re.search(r'(\{[\s\S]*?"buyer_name"[\s\S]*?\})', text)
    if wider_match:
        return wider_match.group(1).strip()
        
    # 2. 備案：尋找任何大括號或中括號區塊 (傳統 Greedy 模式)
    greedy_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
    if greedy_match:
        return greedy_match.group(0).strip()
    
    # 3. 再備案：清除 Markdown 標記
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return cleaned

async def ask_gemini_secretary(text_content: str, image_data_base64: Optional[str] = None, mime_type: str = "image/jpeg", system_prompt: Optional[str] = None, history: Optional[str] = None) -> Optional[Dict]:
    """使用 Gemma 4 31B IT 進行深度解析 (主管角色 - 支援圖片與手寫辨識)"""
    
    default_prompt = f"""【STRICT JSON OUTPUT ONLY】:
1. 嚴禁任何「思維鏈 (Chain of Thought)」或背景分析說明。
2. 此任務為後端自動化介面，請「僅輸出」JSON 資料內容。
3. 輸出必須直接以 `{{` 開始並以 `}}` 結束。

你是一位專業的「EchoOrder 結帳小幫手」，負責從買家提供的圖片中提取收件資訊。
請根據畫面內容，套用以下對應的情境規則提取資料：

【情境一：Google Map 資訊卡 (地圖截圖)】
- 特徵：有店面照片、星級評分、詳細地址與中文店名（如「7-ELEVEN 旗山旗力門市」）。
- 規則：**優先提取中文店名**（如「旗山旗力」），這是比對資料庫的最重要關鍵字。多數資訊卡**不會顯示** 6 位數店號。**絕對禁止猜測或幻想數字**！請將看到的完整店名與地址優先放進 `store_candidates`。

【情境二：7-11 發票或收據單】
- 特徵：有條碼、消費金額、列印時間，通常會明確印出 6 位 store ID 與店名。
- 規則：精準抓取 6 位店號與店名放入 `store_candidates`。**優先查看發票區塊的左下角內容**，那裡通常是正確的門市資訊。**必須排除**所有年份日期（如 113、2024）、超過 6 碼的發票機號、以及夾雜英文的訂單號。

【共通要求】：
1. 找出買家姓名 (`buyer_name`) 與 10 碼電話 (`phone`)。通常顯示在對話視窗最上方或手寫單據的空白處。

【JSON 格式要求】：
{{
  "buyer_name": "買家姓名",
  "phone": "10 碼電話",
  "store_candidates": ["確切看到的店名號或名字"],
  "shipping_info": "如果你看到完整地址，請放在這裡"
}}
"""
    final_system_prompt = system_prompt if system_prompt else default_prompt
    
    if not config.GEMINI_API_KEY:
        print("[AI] ⚠️ API KEY 未設定！無法進行辨識。")
        return None
    
    model_name = config.GEMINI_VISION_MODEL
    
    parts = [{"text": f"待解析內容：\n{text_content}"}]
    if image_data_base64:
        parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": image_data_base64
            }
        })
    
    contents = [{"parts": parts}]
    
    try:
        # 使用通用函式呼叫 API (帶入 system_instruction)
        pure_model_name = model_name.replace("models/", "")
        text_out = await call_ai_studio(pure_model_name, contents, system_instruction=final_system_prompt)
        
        if text_out:
            # [DEBUG] 記錄 AI 原文以便調優
            config.LAST_EVENTS.insert(0, {"time": "ai_raw", "content": f"AI({pure_model_name}) 原文: {text_out[:300]}"})
            
            # 使用穩健的清潔邏輯
            cleaned_json = clean_json_output(text_out)
            
            try:
                result = json.loads(cleaned_json)
                # 姓名長度限制
                if "buyer_name" in result and result["buyer_name"]:
                    result["buyer_name"] = str(result["buyer_name"])[:20]
                return result
            except Exception as parse_e:
                print(f"[AI] JSON 解析失敗: {parse_e}. 清理後內容: {cleaned_json[:100]}")
            
            # Fallback: 正則提取關鍵欄位 (防止 JSON 完全毀損但欄位清晰)
            extracted = {}
            name_m = re.search(r'"buyer_name":\s*"([^"]*)"', text_out)
            phone_m = re.search(r'"phone":\s*"([^"]*)"', text_out)
            info_m = re.search(r'"shipping_info":\s*"([^"]*)"', text_out)
            
            if name_m: extracted["buyer_name"] = name_m.group(1)[:20]
            if phone_m: extracted["phone"] = phone_m.group(1)
            if info_m: extracted["shipping_info"] = info_m.group(1)
            
            if extracted.get("phone") or extracted.get("shipping_info"):
                return extracted

            print(f"[AI] 解析完全失敗。原始輸出: {text_out[:200]}")
            from backend.database.firebase import save_events
            config.LAST_EVENTS.insert(0, {"time": "debug", "content": f"解析完全失敗: {text_out[:200]}"})
            await save_events()
            
    except Exception as e:
        print(f"[AI] AI 秘書處理崩潰: {e}")
        
    return None
