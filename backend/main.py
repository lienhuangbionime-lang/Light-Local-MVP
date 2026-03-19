import sys
import os

# [CRITICAL FIX] Render/Cloud Path Logic
# Always ensure the project root is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

print(f"[SYSTEM] Path Fix: current={current_dir}, parent={parent_dir}")

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import json
import asyncio
import uuid
from typing import Dict, Optional, List
from fastapi.responses import StreamingResponse
import io
import xlsxwriter

# Modular Imports
from backend.config import (
    global_client, INSTANCE_ID, ORDER_POOL, LAST_EVENTS, PROCESSED_COMMENT_IDS,
    SESSION_START_TIME, IS_LIVE_ACTIVE, ADMIN_SECRET, CURRENT_PAGE_ID, ACTIVE_PRODUCTS
)
import backend.config as config
from backend.models.schemas import Order, ConfirmOrderRequest
from backend.core.security import verify_admin_signature, verify_order_signature
from backend.database.firebase import (
    load_orders, load_events, save_orders, clear_orders_on_cloud, 
    sync_state_from_cloud, sync_orders_from_cloud, save_events
)
# from backend.services.fb_service import (
#     process_webhook_data, send_messenger_link, subscribe_page_to_app, save_fb_config, load_fb_config
# )
# from backend.services.order_service import process_order, handle_admin_secretarial_work

@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理全域資源生命週期"""
    print(f"[SYSTEM] 啟動背景同步任務... (Instance: {INSTANCE_ID})")
    
    async def init_task():
        try:
            # 1. 初始化 Firebase (模組層級已改為延遲載入以防啟動卡死)
            from backend.database.firebase import init_firebase
            init_firebase()
            
            # 2. 載入門市索引 (背景執行，不阻塞 HTTP 服務)
            from backend.services.store_service import _load_stores_into_memory
            _load_stores_into_memory()
            
            # 3. 異步載入雲端資料
            await asyncio.gather(load_orders(), load_events())
            
            if config.PAGE_ACCESS_TOKEN and not config.CURRENT_PAGE_ID:
                from backend.services.fb_service import subscribe_page_to_app
                await subscribe_page_to_app(config.PAGE_ACCESS_TOKEN)
            print("[SYSTEM] 初始化完成")
        except Exception as e:
            print(f"[ERROR] 初始化失敗: {e}")

    # 使用 create_task 確保不阻塞啟動
    print(f"[SYSTEM] Create init_task... (Time: {time.time()})")
    asyncio.create_task(init_task())
    yield
    print("[SYSTEM] 正在關閉全域連線...")
    await global_client.aclose()

app = FastAPI(title="EchoOrder Buffer Gateway", lifespan=lifespan)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 基本路由 ---

@app.get("/")
async def root():
    return {
        "message": "EchoOrder Buffer Gateway is running.",
        "docs": "/docs",
        "health": "/api/health",
        "instance": INSTANCE_ID
    }

@app.get("/api/health")
async def health_check():
    try:
        from backend.database.firebase import db
        return {
            "status": "ok",
            "version": "2.2.2 (Stability Fix)",
            "instance_id": INSTANCE_ID,
            "is_live": config.IS_LIVE_ACTIVE,
            "firebase_connected": db is not None,
            "stores_loaded": len(config.ACTIVE_PRODUCTS) > 0 or bool(config.CONFIG_CACHE.get("last_sync")),
            "products_count": len(config.ACTIVE_PRODUCTS),
            "has_fb_token": bool(config.PAGE_ACCESS_TOKEN and config.PAGE_ACCESS_TOKEN != "YOUR_FB_PAGE_TOKEN"),
            "has_ai_key": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
            "env": {
                "PORT": os.environ.get("PORT"),
                "RENDER": bool(os.environ.get("RENDER")),
                "PYTHONPATH": os.environ.get("PYTHONPATH")
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "version": "2.2.2"}

@app.get("/webhook/fb")
async def verify_fb_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == "echo_order_verify_token":
        return Response(content=params.get("hub.challenge"))
    return Response(content="Verification failed", status_code=403)

@app.post("/webhook/fb")
async def fb_webhook(request: Request, background_tasks: BackgroundTasks):
    from backend.services.fb_service import process_webhook_data
    try:
        data = await request.json()
        return await process_webhook_data(data, background_tasks)
    except Exception as e:
        print(f"[WEBHOOK] 解析失敗: {e}")
        return {"status": "error"}

# --- 賣家管理路由 ---

@app.get("/api/seller/orders/all")
async def get_all_orders():
    await sync_state_from_cloud(sync_orders=True)
    session_orders = [o.dict() for o in ORDER_POOL.values() if o.created_at >= config.SESSION_START_TIME]
    return {"orders": session_orders, "processed_comment_ids": list(PROCESSED_COMMENT_IDS)}

@app.post("/api/seller/sync_products")
async def update_products(request: Request, data: Dict):
    """更新商品代號表 (支援完整與巢狀結構)"""
    sig = request.headers.get("X-Admin-Signature")
    ts = request.headers.get("X-Admin-Timestamp")
    
    is_valid = verify_admin_signature(sig, ts)
    print(f"[DEBUG] Sync Products Attempt: ts={ts}, sig={sig}, valid={is_valid}")
    
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    # 自動拆解前端傳入的 { active_products: { ... }, free_shipping_threshold? } 
    products = data.get("active_products", {})
    threshold = data.get("free_shipping_threshold")
    
    if threshold is not None:
        config.FREE_SHIPPING_THRESHOLD = int(threshold)
    
    config.ACTIVE_PRODUCTS.clear()
    config.ACTIVE_PRODUCTS.update(products)
    await save_orders(save_config=True, fields=["active_products", "free_shipping_threshold"])
    return {"status": "success", "count": len(products), "threshold": config.FREE_SHIPPING_THRESHOLD}

# 舊端點相容別名
@app.post("/api/seller/active_products")
async def update_products_legacy(request: Request, data: Dict):
    return await update_products(request, data)

@app.post("/api/seller/config")
async def update_config(data: Dict):
    if "fb_page_token" in data:
        token = data["fb_page_token"].strip()
        config.PAGE_ACCESS_TOKEN = token
        save_fb_config({"fb_page_token": token})
    return {"status": "success"}

@app.post("/api/seller/subscribe_page")
async def subscribe_page(data: Dict):
    token = data.get("token") or config.PAGE_ACCESS_TOKEN
    return await subscribe_page_to_app(token)

@app.get("/api/seller/live/status")
async def get_live_status():
    return {"is_live_active": config.IS_LIVE_ACTIVE, "session_start_time": config.SESSION_START_TIME}

@app.post("/api/seller/live/status")
async def set_live_status(data: Dict):
    config.IS_LIVE_ACTIVE = data.get("is_live_active", config.IS_LIVE_ACTIVE)
    if config.IS_LIVE_ACTIVE:
        config.SESSION_START_TIME = data.get("session_start_time", time.time())
    config.FREE_SHIPPING_THRESHOLD = data.get("free_shipping_threshold", config.FREE_SHIPPING_THRESHOLD)
    config.SHIPPING_FEE = data.get("shipping_fee", config.SHIPPING_FEE)
    
    await save_orders(save_config=True, fields=["is_live_active", "session_start_time", "free_shipping_threshold", "shipping_fee"])
    return {"status": "success"}

@app.get("/api/seller/stats")
async def get_stats():
    """統計銷售數據"""
    stats = {}
    for order in ORDER_POOL.values():
        if order.created_at < config.SESSION_START_TIME: continue
        for item in order.items:
            code = item.product_code
            stats[code] = stats.get(code, 0) + item.quantity
    return stats

@app.post("/api/seller/harvest")
async def run_harvest(request: Request):
    """批次將 PENDING 轉為 HARVESTED (需要管理員簽名)"""
    sig = request.headers.get("X-Admin-Signature")
    ts = request.headers.get("X-Admin-Timestamp")
    if not verify_admin_signature(sig, ts):
        print(f"[SECURITY] Harvest blocked: Invalid signature (sig={sig}, ts={ts})")
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    count = 0
    for order in ORDER_POOL.values():
        if order.status == "PENDING" and order.created_at >= config.SESSION_START_TIME:
            order.status = "HARVESTED"
            await save_orders(order_id=order.order_id)
            count += 1
    return {"status": "success", "harvested": count}

@app.delete("/api/seller/orders")
async def clear_orders_endpoint(request: Request):
    sig = request.headers.get("X-Admin-Signature")
    ts = request.headers.get("X-Admin-Timestamp")
    
    is_valid = verify_admin_signature(sig, ts)
    print(f"[DEBUG] Clear Orders Attempt: ts={ts}, sig={sig}, valid={is_valid}")
    
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized")
    config.ORDER_POOL.clear()
    config.PROCESSED_COMMENT_IDS.clear()
    deleted = await clear_orders_on_cloud()
    return {"status": "success", "count": deleted}

@app.post("/api/seller/reset_system")
async def reset_system(request: Request, data: Dict):
    """徹底重設系統 (包含代號表與訂單)"""
    sig = request.headers.get("X-Admin-Signature")
    ts = request.headers.get("X-Admin-Timestamp")
    if not verify_admin_signature(sig, ts):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    config.ORDER_POOL.clear()
    config.PROCESSED_COMMENT_IDS.clear()
    if data.get("deep_reset"):
        config.ACTIVE_PRODUCTS.clear()
    
    await save_orders(save_config=True, fields=["active_products", "processed_comment_ids"])
    await clear_orders_on_cloud()
    return {"status": "success", "message": "系統已成功歸零"}

@app.get("/api/debug/time")
async def get_server_time():
    """檢查伺服器時間與 Secret 狀態 (Debug 用)"""
    return {
        "server_time": time.time(),
        "admin_secret_set": len(config.ADMIN_SECRET) > 0,
        "admin_secret_preview": f"{config.ADMIN_SECRET[:3]}***" if config.ADMIN_SECRET else "NONE"
    }

# --- 買家結帳路由 ---

@app.get("/api/checkout/{order_id}")
async def get_checkout(order_id: str, s: Optional[str] = None):
    # 如果有帶 s，也要驗證一下安全性 (雖然原代碼只有 GET，但補上驗證更好)
    if s and not verify_order_signature(order_id, s):
        raise HTTPException(status_code=403, detail="Invalid Signature")
        
    if order_id not in ORDER_POOL: await sync_orders_from_cloud()
    # 為了計算方便，將最新的 price_rule 注入到訂單項目的 metadata 中
    if order_id in ORDER_POOL:
        order_data = ORDER_POOL[order_id].model_dump()
        # 注入全域免運門檻與商品中繼資料
        order_data["config"] = {
            "products": config.ACTIVE_PRODUCTS,
            "free_shipping_threshold": config.FREE_SHIPPING_THRESHOLD,
            "shipping_fee": config.SHIPPING_FEE
        }
        for item in order_data.get("items", []):
            p_data = config.ACTIVE_PRODUCTS.get(item["product_code"], {})
            if isinstance(p_data, dict):
                item["price_rule"] = p_data.get("price_rule", "")
        return order_data
    raise HTTPException(status_code=404, detail="Order not found")

@app.post("/api/checkout/{order_id}/ai_fill")
async def ai_fill_checkout(order_id: str, request: Request, s: Optional[str] = None):
    """從圖片中辨識收件人資訊 (客戶端專用)"""
    if not verify_order_signature(order_id, s):
        print(f"[SECURITY] AI Fill blocked: Invalid Signature (order={order_id})")
        raise HTTPException(status_code=403, detail="Invalid Signature")
        
    from backend.services.ai_service import ask_gemini_secretary
    try:
        data_json = await request.json()
        image_b64 = data_json.get("image")
        if not image_b64:
             return {"status": "error", "message": "未接收到圖片資料"}

        prompt = """你現在是「EchoOrder 結帳小幫手」。你的任務是從圖片中【精確】提取收件資訊。
請【嚴格】回傳以下 JSON 格式：
{
  "buyer_name": "完整的收件人姓名 (優先抓取截圖頂部的對話對象名稱)",
  "phone": "10 碼電話 (如 0972907584)",
  "shipping_info": "7-11 門市資訊。規則：1. 如果截圖中有明顯的 6 位數【店號】，請填寫店號。2. 如果沒有店號但有【門市名稱】(如：旗山旗力)，請『直接填寫門市名稱』，不要隨意猜測 6 位數。3. 絕對不要回傳地址。4. 如果只有店名，請僅回傳店名，後端將自動查詢店號。"
}
注意：如果你不確定店號，回傳「門市名稱」比回傳錯誤的數字更好。絕對禁止回傳「店名 (店號)」這種格式，請擇一。"""
        
        extracted = await ask_gemini_secretary(text_content="[USER PHOTO FILL]", image_data_base64=image_b64, system_prompt=prompt)
        
        if extracted and isinstance(extracted, dict):
            # 1. 清理電話
            if "phone" in extracted and extracted["phone"]:
                extracted["phone"] = "".join(filter(str.isdigit, str(extracted["phone"])))
            
            # 2. 清理店號 (智慧語意比對)
            if "shipping_info" in extracted and extracted["shipping_info"]:
                from backend.services.store_service import resolve_store_info
                raw_extracted_info = str(extracted["shipping_info"])
                # 使用向量搜尋或精確比對轉換為 "店號 店名"
                extracted["shipping_info"] = await resolve_store_info(raw_extracted_info)
            
            print(f"[AI_FILL] Final Parsed Result: {extracted}")
            config.LAST_EVENTS.insert(0, {"time": "ai_ok", "content": f"AI 填單成功: {extracted.get('buyer_name')} - {extracted.get('shipping_info')}"})
            from backend.database.firebase import save_events
            await save_events()
            return {"status": "success", "data": extracted}
        
        print(f"[AI_FILL] 解析失敗或格式錯誤: {extracted}")
        return {"status": "error", "message": "AI 無法從此圖片辨識到有效的姓名、電話或門市。"}
    except Exception as e:
        print(f"[AI_FILL] 處理崩潰: {e}")
        return {"status": "error", "message": f"伺服器處理異常: {str(e)}"}

@app.post("/api/seller/pull_live_comments")
async def pull_comments_endpoint(data: Dict, background_tasks: BackgroundTasks):
    """主動拉取 FB 直播留言 (Polling 模式)"""
    from backend.services.fb_service import pull_live_comments
    token = data.get("token") or config.PAGE_ACCESS_TOKEN
    return await pull_live_comments(token, background_tasks)

@app.post("/api/seller/orders/restore")
async def restore_orders_endpoint(data: Dict):
    """自癒功能：從前端恢復丟失的狀態"""
    count = 0
    if "orders" in data:
        for o_data in data["orders"]:
            try:
                # 簡單轉換 dictionary 為 Order 對象
                new_order = Order(**o_data)
                config.ORDER_POOL[new_order.order_id] = new_order
                count += 1
            except Exception:
                continue
    
    if "processed_comment_ids" in data:
        config.PROCESSED_COMMENT_IDS.update(data["processed_comment_ids"])
    
    return {"status": "success", "restored": count}

@app.post("/api/checkout/{order_id}/confirm")
async def confirm_checkout(order_id: str, data: Dict, s: Optional[str] = None):
    if not verify_order_signature(order_id, s):
        raise HTTPException(status_code=403, detail="Invalid Signature")
    if order_id not in ORDER_POOL: await sync_orders_from_cloud()
    if order_id in ORDER_POOL:
        order = ORDER_POOL[order_id]
        order.buyer_name = data.get("buyer_name")
        order.shipping_info = data.get("shipping_info")
        order.phone = data.get("phone")
        order.status = "CONFIRMED"
        await save_orders(order_id=order_id)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Order not found")

# --- Debug & Utility ---

@app.get("/api/debug/events")
async def get_debug_events():
    return config.LAST_EVENTS

@app.get("/api/debug/products")
async def get_debug_products():
    """查看目前載入的商品字典"""
    return {
        "product_count": len(config.ACTIVE_PRODUCTS),
        "active_products": config.ACTIVE_PRODUCTS
    }

@app.get("/api/admin/config_check")
async def check_config(admin_secret: Optional[str] = None):
    # 此處可供使用者在線上檢查環境變數是否設定正確
    if admin_secret != config.ADMIN_SECRET:
        return {"status": "error", "message": "Unauthorized"}
    
    return {
        "GEMINI_API_KEY": f"SET (ends with {config.GEMINI_API_KEY[-4:]})" if config.GEMINI_API_KEY else "MISSING ❌",
        "PAGE_ACCESS_TOKEN": "SET" if config.PAGE_ACCESS_TOKEN else "MISSING ❌",
        "INFO": "請確保在 Render.com 後台的 Environment Variables 正確設定了這些值。"
    }

@app.post("/api/admin/sync_official_stores")
@app.get("/api/admin/sync_official_stores")
async def sync_stores_endpoint(background_tasks: BackgroundTasks, admin_secret: Optional[str] = None, force: bool = False):
    """手動觸發全台 7-11 門市同步任務 (僅更新新增門市，或使用 force=true 強制全部重刷)"""
    if admin_secret != config.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    from backend.services.store_service import sync_official_stores_task
    background_tasks.add_task(sync_official_stores_task, force=force)
    return {"status": "success", "message": f"全台門市同步任務已在背景啟動 (Force={force})。"}

@app.delete("/api/debug/events")
async def clear_events():
    config.LAST_EVENTS.clear()
    await save_events()
    return {"status": "success"}

@app.post("/api/debug/simulate_webhook")
async def simulate_webhook(data: Dict, background_tasks: BackgroundTasks):
    """
    開發用：允許兩種 payload
    1) 完整 FB Webhook（含 entry/changes/messaging）
    2) 簡化測試格式：{ code: "A", quantity: 2, sender_id?, sender_name? }
    """
    if "entry" not in data and "code" in data:
        code = str(data.get("code", "")).strip().upper()
        qty = int(data.get("quantity", 1) or 1)
        sender_id = str(data.get("sender_id", "u_sim"))
        sender_name = str(data.get("sender_name", "Simulator"))
        # Wrap into FB feed comment change format expected by process_webhook_data
        data = {
            "object": "page",
            "entry": [
                {
                    "id": config.CURRENT_PAGE_ID or "page_sim",
                    "time": int(time.time()),
                    "changes": [
                        {
                            "field": "feed",
                            "value": {
                                "item": "comment",
                                "message": f"{code}+{qty}",
                                "from": {"id": sender_id, "name": sender_name},
                                "comment_id": f"sim_{uuid.uuid4().hex[:8]}",
                            },
                        }
                    ],
                }
            ],
        }

    return await process_webhook_data(data, background_tasks, is_simulated=True)

@app.post("/api/admin/emergency/recover_order")
async def recover_order(data: Dict):
    """
    緊急補單功能：手動恢復遺失的 PENDING 訂單
    payload: { admin_secret, order_id, buyer_name, items: [{code, qty}] }
    """
    if data.get("admin_secret") != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    order_id = data.get("order_id")
    if not order_id: return {"status": "error", "message": "Missing order_id"}
    
    order_items = []
    for it in data.get("items", []):
        code = it.get("code", "").upper()
        qty = it.get("qty", 1)
        p_data = config.ACTIVE_PRODUCTS.get(code, {})
        p_name = p_data.get("name", code) if isinstance(p_data, dict) else p_data
        p_rule = p_data.get("price_rule", "") if isinstance(p_data, dict) else ""
        from backend.services.order_service import get_price_from_rule
        total_p = get_price_from_rule(p_rule, qty)
        unit_p = total_p // qty if qty > 0 else 0
        order_items.append(OrderItem(product_code=code, quantity=qty, product_name=p_name, price=unit_p))

    new_order = Order(
        order_id=order_id,
        fb_user_name=data.get("buyer_name", "Recovered User"),
        items=order_items,
        status="PENDING",
        created_at=time.time(),
        instance_id=config.INSTANCE_ID
    )
    
    config.ORDER_POOL[order_id] = new_order
    await save_orders(order_id=order_id)
    return {"status": "success", "message": f"Order {order_id} recovered to database"}

@app.get("/api/seller/orders/export_xlsx")
async def export_orders():
    """
    導出符合 7-11 賣貨便 (MyShip) 批量進貨格式的 Excel
    欄位參考自：賣貨便_訂單匯入結果_2603191084664270.xlsm
    """
    import io
    import time
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet()
    
    # [V2.2.0] 根據 7-11 賣貨便最新官方範本格式
    headers = ["＊取件人姓名", "＊取件人手機", "＊取件門市", "* 溫層", "＊商品", "＊訂單金額", "＊運費金額", "買家下訂日期", "商品備註"]
    header_fmt = workbook.add_format({'bold': True, 'align': 'center', 'bg_color': '#DDEBF7'})
    
    for i, h in enumerate(headers): 
        worksheet.write(0, i, h, header_fmt)
    
    row = 1
    # 使用 list 避免在迭代時字典大小變更
    for o in list(ORDER_POOL.values()):
        if o.created_at < config.SESSION_START_TIME: continue
        if o.status != "CONFIRMED" and o.status != "HARVESTED": continue
        
        # 1. 提取 6 碼店號 (必須是 6 碼)
        store_id = ""
        if o.shipping_info:
            import re
            match = re.search(r'\d{6}', o.shipping_info)
            if match:
                store_id = match.group(0)
            else:
                # 嘗試透過店名反查
                from backend.services.store_service import resolve_store_info
                import asyncio
                try:
                    # 在生命週期內反查
                    resolved = await resolve_store_info(o.shipping_info)
                    match = re.search(r'\d{6}', resolved)
                    if match: store_id = match.group(0)
                except: pass

        # 2. 商品項格式化 (品名 x 數量)
        items_summary = ", ".join([f"{i.product_name or i.product_code} x {i.quantity}" for i in o.items])
        
        # 3. 費用計算
        total_items_price = sum((item.price or 0) * item.quantity for item in o.items)
        total_qty = sum(item.quantity for item in o.items)
        is_free = total_qty >= config.FREE_SHIPPING_THRESHOLD
        shipping_fee = 0 if is_free else config.SHIPPING_FEE
        
        # 寫入資料
        worksheet.write(row, 0, o.buyer_name or o.fb_user_name)     # ＊取件人姓名
        worksheet.write(row, 1, o.phone or "")                      # ＊取件人手機
        worksheet.write(row, 2, store_id)                           # ＊取件門市
        worksheet.write(row, 3, "常溫")                             # * 溫層
        worksheet.write(row, 4, items_summary)                      # ＊商品
        worksheet.write(row, 5, total_items_price)                  # ＊訂單金額
        worksheet.write(row, 6, shipping_fee)                       # ＊運費金額
        worksheet.write(row, 7, time.strftime("%Y/%m/%d", time.localtime(o.created_at)) if o.created_at else "") # 下訂日期
        worksheet.write(row, 8, f"OID: {o.order_id}")                # 備註
        row += 1
    
    workbook.close()
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=711_myship_orders.xlsx"}
    )
    
    workbook.close()
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=711_myship_orders.xlsx"}
    )

if __name__ == "__main__":
    import uvicorn
    # Render 會注入 PORT 環境變數，若無則預設 10000 (Render 預設) 或 8000
    port = int(os.environ.get("PORT", 10000))
    print(f"[SYSTEM] 啟動伺服器於 Port: {port} (RELOAD=True)")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
else:
    # 這是被 uvicorn 命令列啟動時 (例如 Docker/Render)
    import os
    print(f"[SYSTEM] 模組載入中... PORT={os.environ.get('PORT')}")
