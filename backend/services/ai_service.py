import re
import json
import os
import hashlib
import asyncio
from typing import Optional, Dict, Any, List
from backend.config import ACTIVE_PRODUCTS, global_client
import backend.config as config

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

async def call_ai_studio(model_name: str, contents: List[Dict]) -> Optional[str]:
    """通用 Google AI Studio API 呼叫函式"""
    if not config.GEMINI_API_KEY:
        return None
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={config.GEMINI_API_KEY}"
    
    try:
        res = await global_client.post(url, json={"contents": contents}, timeout=60.0)
        if res.status_code == 200:
            raw_res = res.json()
            return raw_res.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        else:
            print(f"[AI] {model_name} 請求失敗 ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"[AI] {model_name} 呼叫異常: {e}")
    return None

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
    """使用 Gemma 3 27B 進行初步診斷與 FAQ 回覆 (接待員角色 - 額度高)"""
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
    contents = [{"parts": [{"text": system_prompt + f"\n\n買家留言：\n{text_content}"}]}]
    text_out = await call_ai_studio("gemma-3-27b", contents) # 預設使用 Gemma 3
    
    if text_out:
        json_match = re.search(r'\{.*\}', text_out, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except: pass
    return None

async def ask_gemini_secretary(text_content: str, image_data_base64: Optional[str] = None, mime_type: str = "image/jpeg", system_prompt: Optional[str] = None, history: Optional[str] = None) -> Optional[Dict]:
    """使用 Gemini 2.0 Flash 進行深度解析 (主管角色 - 聰明且支援圖片辨識)"""
    catalog_str = "\n".join([f"- {code}: {name}" for code, name in ACTIVE_PRODUCTS.items()])
    history_context = f"\n\n【該買家近期訂單歷史】：\n{history}" if history else ""
    
    default_prompt = f"""
你是一位專業的「FB直播 AI 秘書 (Gemma)」。
請從截圖或文字中提取訂單資訊。
請【嚴格回傳 JSON】，不要包含任何描述文字或 Markdown。

【可用的商品代號列表】：
{catalog_str}{history_context}

【JSON 格式要求】：
{{
  "buyer_name": "買家姓名 (預設空字串)",
  "phone": "電話 (預設空字串)",
  "shipping_info": "門市名稱或店號 (預設空字串)",
  "items": [
    {{ "product_code": "代號", "quantity": 數量 }}
  ],
  "is_duplicate": false
}}
"""
    final_system_prompt = system_prompt if system_prompt else default_prompt
    
    if not config.GEMINI_API_KEY:
        print("[AI] ⚠️ API KEY 未設定！無法進行辨識。")
        return None
    
    model_name = config.GEMINI_VISION_MODEL
    parts = [{"text": final_system_prompt + f"\n\n待解析內容：\n{text_content}"}]
    if image_data_base64:
        parts.append({
            "inlineData": {
                "mimeType": mime_type,
                "data": image_data_base64
            }
        })
    
    contents = [{"parts": parts}]
    
    try:
        # 使用通用函式呼叫 API (去掉 models/ 前綴以相容 call_ai_studio)
        pure_model_name = model_name.replace("models/", "")
        text_out = await call_ai_studio(pure_model_name, contents)
        
        if text_out:
            # [DEBUG] 記錄 AI 原文以便調優
            config.LAST_EVENTS.insert(0, {"time": "ai_raw", "content": f"AI({pure_model_name}) 原文: {text_out[:300]}"})
            
            json_match = re.search(r'\{.*\}', text_out, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except: pass
            
            # Fallback: 手動提取關鍵欄位
            extracted = {}
            name_m = re.search(r'"buyer_name":\s*"([^"]*)"', text_out)
            phone_m = re.search(r'"phone":\s*"([^"]*)"', text_out)
            info_m = re.search(r'"shipping_info":\s*"([^"]*)"', text_out)
            
            if name_m: extracted["buyer_name"] = name_m.group(1)
            if phone_m: extracted["phone"] = phone_m.group(1)
            if info_m: extracted["shipping_info"] = info_m.group(1)
            
            if extracted.get("phone") or extracted.get("shipping_info"):
                return extracted

            print(f"[AI] 解析失敗。原始輸出: {text_out[:200]}")
            from backend.database.firebase import save_events
            config.LAST_EVENTS.insert(0, {"time": "debug", "content": f"解析失敗: {text_out[:200]}"})
            await save_events()
            
    except Exception as e:
        print(f"[AI] AI 秘書處理崩潰: {e}")
        
    return None
