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

async def clear_orders_on_cloud(pending_only: bool = False):
    """
    清理雲端訂單資料：
    - pending_only=True: 僅清空 /orders (內容應皆為未填單連結)
    - pending_only=False (Force): 同時清空 /orders 與 /archived_orders (徹底掃除)
    """
    if not db: return 0
    try:
        def _cleanup():
            count = 0
            # 1. 清理活躍區 (/orders)
            active_docs = db.collection("orders").stream()
            batch = db.batch()
            for doc in active_docs:
                batch.delete(doc.reference)
                count += 1
                if count % 500 == 0:
                    batch.commit()
                    batch = db.batch()
            if count % 500 != 0: batch.commit()

            # 2. 如果是深度大掃除，才清理封存區 (/archived_orders)
            if not pending_only:
                arch_docs = db.collection("archived_orders").stream()
                batch = db.batch()
                a_count = 0
                for doc in arch_docs:
                    batch.delete(doc.reference)
                    a_count += 1
                    if a_count % 500 == 0:
                        batch.commit()
                        batch = db.batch()
                if a_count % 500 != 0: batch.commit()
                count += a_count

                # 清理鎖與留言記錄
                lock_docs = db.collection("locks").stream()
                for ldoc in lock_docs:
                    ldoc.reference.delete()
            
            return count
            
        total_processed = await asyncio.to_thread(_cleanup)
        print(f"[FIREBASE] 雲端清理完成 ({'僅活躍區' if pending_only else '全部區'}): 處理 {total_processed} 筆")
        return total_processed
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
        def _get_all_orders():
            # 同步活躍訂單 (通常為剛開單未填單)
            orders = db.collection("orders").stream()
            # 同步所有封存訂單 (成交單)，不分場次連併累計
            archived = db.collection("archived_orders").stream()
            return list(orders), list(archived)
            
        order_docs, archived_docs = await asyncio.to_thread(_get_all_orders)
        for doc in (order_docs + archived_docs):
            config.ORDER_POOL[doc.id] = Order(**doc.to_dict())
    except Exception as e:
        print(f"[FIREBASE] 訂單同步失敗: {e}")

async def save_orders(save_config: bool = False, fields: Optional[List[str]] = None, order_id: Optional[str] = None, move_to_archive: bool = False):
    if not db: return
    try:
        def _save():
            batch = db.batch()
            if order_id and order_id in config.ORDER_POOL:
                target_collection = "archived_orders" if move_to_archive else "orders"
                doc_ref = db.collection(target_collection).document(order_id)
                # Pydantic V2 uses model_dump
                order_data = config.ORDER_POOL[order_id]
                data_dict = order_data.model_dump() if hasattr(order_data, 'model_dump') else order_data.dict()
                batch.set(doc_ref, data_dict)
                
                # 如果是搬移到封存區，要同步刪除原 orders 中的文件
                if move_to_archive:
                    old_ref = db.collection("orders").document(order_id)
                    batch.delete(old_ref)
                    
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
        print("[FIREBASE] 正在同步載入訂單 (含封存區)...")
        if not db: return
        
        def _load():
            config_doc = db.collection("system").document("config").get()
            docs = db.collection("orders").get()
            # 🚀 同時載入封存區訂單，確保成交單在重啟後依然存在於記憶體中以利匯出
            arch_docs = db.collection("archived_orders").get()
            return config_doc, docs, arch_docs
            
        config_doc, docs, arch_docs = await asyncio.to_thread(_load)

        if config_doc.exists:
            data = config_doc.to_dict()
            config.ACTIVE_PRODUCTS.clear()
            config.ACTIVE_PRODUCTS.update(data.get("active_products", {}))
            config.PROCESSED_COMMENT_IDS.update(data.get("processed_comment_ids", []))
            config.IS_LIVE_ACTIVE = data.get("is_live_active", False)
            config.SESSION_START_TIME = data.get("session_start_time", 0.0)
            config.CURRENT_PAGE_ID = data.get("fb_page_id", "")
        
        for doc in (list(docs) + list(arch_docs)):
            config.ORDER_POOL[doc.id] = Order(**doc.to_dict())
        print(f"[FIREBASE] 已載入 {len(config.ORDER_POOL)} 筆訂單 (含封存)")
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
async def sync_711_stores_from_cloud():
    """從 Firestore 同步 7-11 門市資料並存入本地快取"""
    if not db: return {"status": "error", "message": "Firebase not initialized"}
    
    try:
        print("[FIREBASE] 正在從雲端抓取 7-11 門市資料...")
        def _get_stores():
            # 使用 stream() 處理大量資料
            return db.collection("stores_711").stream()
        
        docs = list(await asyncio.to_thread(_get_stores))
        print(f"[FIREBASE] 雲端查詢完成，收件到 {len(docs)} 個文檔預覽...")
        
        stores_data = {}
        count = 0
        for doc in docs:
            data = doc.to_dict()
            if not data: continue
            # 格式轉換為本地 store_service 期待的樣子
            stores_data[doc.id] = {
                "id": doc.id,
                "name": data.get("name", "未知"),
                "address": data.get("address", "")
            }
            count += 1
            if count % 1000 == 0: print(f"[FIREBASE] 已處理 {count} 筆門市...")

        # 儲存到本地 scripts/stores_cloud.json
        import json
        save_path = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "stores_cloud.json")
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(stores_data, f, ensure_ascii=False, indent=2)
            
        print(f"[FIREBASE] 同步成功！共 {count} 筆門市儲存至: {save_path}")
        if count == 0:
            print("[WARNING] 注意！雲端 stores_711 集合似乎是空的，請檢查 Firestore 資料架構。")
        return {"status": "success", "count": count}
    except Exception as e:
        print(f"[FIREBASE] 門市同步失敗: {e}")
        return {"status": "error", "message": str(e)}
