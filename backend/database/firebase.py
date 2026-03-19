import firebase_admin
from firebase_admin import credentials, firestore
import os
import asyncio
import time
from typing import Optional, List
from backend.models.schemas import Order
import backend.config as config

db = None

def init_firebase():
    global db
    try:
        if not firebase_admin._apps:
            if os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
                import json
                cred_dict = json.loads(os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"))
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("[FIREBASE] 使用環境變數初始化成功")
            else:
                POTENTIAL_PATHS = [
                    config.FIREBASE_KEY_PATH,
                    os.path.join(os.path.dirname(__file__), "..", config.FIREBASE_KEY_PATH),
                    os.path.join(os.path.dirname(__file__), config.FIREBASE_KEY_PATH)
                ]
                target_path = next((p for p in POTENTIAL_PATHS if os.path.exists(p)), None)
                if target_path:
                    cred = credentials.Certificate(target_path)
                    firebase_admin.initialize_app(cred)
                    print(f"[FIREBASE] 使用檔案 {target_path} 初始化成功")
                else:
                    print("[WARNING] 找不到 Firebase 金鑰")

        db = firestore.client()
    except Exception as e:
        print(f"[ERROR] Firebase 初始化失敗: {e}")

# Removed module-level call to prevent hangs during import
# init_firebase() 

async def save_events(force: bool = False):
    if not db: return
    now = time.time()
    # Logic for throttling save_events can be added here if needed, 
    # but for simplicity in refactor, we keep it straightforward.
    try:
        def _save():
            db.collection("system").document("debug_events").set({"events": config.LAST_EVENTS})
        await asyncio.to_thread(_save)
    except Exception as e:
        print(f"[FIREBASE] 儲存日誌失敗: {e}")

async def acquire_lock(comment_id: str) -> bool:
    if not db or not comment_id: return True
    try:
        def _create():
             db.collection("locks").document(comment_id).create({
                "timestamp": time.time(),
                "instance": config.INSTANCE_ID
            })
        await asyncio.to_thread(_create)
        return True
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"[LOCK] 鎖定異常 ({comment_id}): {str(e)}")
        return False

async def clear_orders_on_cloud():
    if not db: return 0
    try:
        def _cleanup():
            batch = db.batch()
            count = 0
            docs = db.collection("orders").stream()
            for doc in docs:
                batch.delete(doc.reference)
                count += 1
                if count % 500 == 0:
                    batch.commit()
                    batch = db.batch()
            
            if count % 500 != 0:
                batch.commit()
            
            # Clear locks too
            lock_docs = db.collection("locks").stream()
            for ldoc in lock_docs:
                ldoc.reference.delete()
            return count
            
        deleted_count = await asyncio.to_thread(_cleanup)
        print(f"[FIREBASE] 雲端清理完成：刪除 {deleted_count} 筆訂單")
        return deleted_count
    except Exception as e:
        print(f"[FIREBASE] 雲端清理失敗: {e}")
        return 0

async def sync_state_from_cloud(sync_orders: bool = False, force: bool = False):
    if not db: return
    now = time.time()
    
    if not force and "config" in config.CONFIG_CACHE and (now - config.CONFIG_CACHE["config"]["time"]) < 10.0:
        if not sync_orders: return

    try:
        def _get_config():
            return db.collection("system").document("config").get()
            
        cfg_doc = await asyncio.to_thread(_get_config)
        if cfg_doc.exists:
            data = cfg_doc.to_dict()
            config.ACTIVE_PRODUCTS.clear()
            config.ACTIVE_PRODUCTS.update(data.get("active_products", {}))
            config.IS_LIVE_ACTIVE = data.get("is_live_active", config.IS_LIVE_ACTIVE)
            config.SESSION_START_TIME = data.get("session_start_time", config.SESSION_START_TIME)
            config.CURRENT_PAGE_ID = data.get("fb_page_id", config.CURRENT_PAGE_ID)
            config.FREE_SHIPPING_THRESHOLD = data.get("free_shipping_threshold", config.FREE_SHIPPING_THRESHOLD)
            config.SHIPPING_FEE = data.get("shipping_fee", 38)
            config.GEMINI_EMBEDDING_MODEL = data.get("gemini_embedding_model", config.GEMINI_EMBEDDING_MODEL)
            config.GEMINI_VISION_MODEL = data.get("gemini_vision_model", config.GEMINI_VISION_MODEL)
            config.PROCESSED_COMMENT_IDS.update(data.get("processed_comment_ids", []))
            config.CONFIG_CACHE["config"] = {"time": now, "data": data}
        
        if sync_orders:
            await sync_orders_from_cloud()
    except Exception as e:
        print(f"[FIREBASE] 熱同步失敗: {e}")

async def sync_orders_from_cloud():
    if not db: return
    try:
        def _get_orders():
            return db.collection("orders").stream()
        docs = await asyncio.to_thread(_get_orders)
        for doc in docs:
            config.ORDER_POOL[doc.id] = Order(**doc.to_dict())
    except Exception as e:
        print(f"[FIREBASE] 訂單同步失敗: {e}")

async def save_orders(save_config: bool = False, fields: Optional[List[str]] = None, order_id: Optional[str] = None):
    if not db: return
    try:
        def _save():
            batch = db.batch()
            if order_id and order_id in config.ORDER_POOL:
                doc_ref = db.collection("orders").document(order_id)
                # Pydantic V2 uses model_dump
                order_data = config.ORDER_POOL[order_id]
                data_dict = order_data.model_dump() if hasattr(order_data, 'model_dump') else order_data.dict()
                batch.set(doc_ref, data_dict)
            elif not order_id and not save_config:
                return

            if save_config:
                config_ref = db.collection("system").document("config")
                payload = {
                    "active_products": config.ACTIVE_PRODUCTS,
                    "processed_comment_ids": list(config.PROCESSED_COMMENT_IDS),
                    "is_live_active": config.IS_LIVE_ACTIVE,
                    "session_start_time": config.SESSION_START_TIME,
                    "fb_page_id": config.CURRENT_PAGE_ID,
                    "free_shipping_threshold": config.FREE_SHIPPING_THRESHOLD,
                    "shipping_fee": config.SHIPPING_FEE
                }
                if fields:
                    payload = {k: v for k, v in payload.items() if k in fields}
                batch.set(config_ref, payload, merge=True)
            batch.commit()
        await asyncio.to_thread(_save)
    except Exception as e:
        print(f"[FIREBASE] 同步雲端失敗: {e}")

async def load_orders():
    """啟動時載入所有訂單與設定"""
    try:
        print("[FIREBASE] 正在同步載入訂單...")
        if not db: return
        
        def _load():
            config_doc = db.collection("system").document("config").get()
            docs = db.collection("orders").get()
            return config_doc, docs
            
        config_doc, docs = await asyncio.to_thread(_load)

        if config_doc.exists:
            data = config_doc.to_dict()
            config.ACTIVE_PRODUCTS.clear()
            config.ACTIVE_PRODUCTS.update(data.get("active_products", {}))
            config.PROCESSED_COMMENT_IDS.update(data.get("processed_comment_ids", []))
            config.IS_LIVE_ACTIVE = data.get("is_live_active", False)
            config.SESSION_START_TIME = data.get("session_start_time", 0.0)
            config.CURRENT_PAGE_ID = data.get("fb_page_id", "")
        
        for doc in docs:
            config.ORDER_POOL[doc.id] = Order(**doc.to_dict())
        print(f"[FIREBASE] 已載入 {len(config.ORDER_POOL)} 筆訂單")
    except Exception as e:
        print(f"[ERROR] load_orders 失敗: {e}")

async def load_events():
    """載入除錯日誌"""
    if not db: return
    try:
        def _load():
            return db.collection("system").document("debug_events").get()
        doc = await asyncio.to_thread(_load)
        if doc.exists:
            data = doc.to_dict()
            config.LAST_EVENTS.clear()
            config.LAST_EVENTS.extend(data.get("events", []))
    except Exception as e:
        print(f"[FIREBASE] 載入日誌失敗: {e}")
