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
from backend.services.fb_service import (
    process_webhook_data, send_messenger_link, subscribe_page_to_app, save_fb_config, load_fb_config
)
from backend.services.order_service import process_order, handle_admin_secretarial_work

@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理全域資源生命週期"""
    print(f"[SYSTEM] 啟動背景同步任務... (Instance: {INSTANCE_ID})")
    # [CRITICAL] Await loading to ensure memory is populated before requests arrive
    try:
        await asyncio.gather(load_orders(), load_events())
        if config.PAGE_ACCESS_TOKEN and not config.CURRENT_PAGE_ID:
            from backend.services.fb_service import subscribe_page_to_app
            await subscribe_page_to_app(config.PAGE_ACCESS_TOKEN)
        print("[SYSTEM] 初始化完成")
    except Exception as e:
        print(f"[ERROR] 初始化失敗: {e}")
    yield
    print("[SYSTEM] 正在關閉全域連線...")
    await global_client.aclose()

app = FastAPI(title="EchoOrder Buffer Gateway", lifespan=lifespan)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    return {
        "status": "ok",
        "version": "2.1.0 (Modular Refactor)",
        "instance_id": INSTANCE_ID,
        "is_live": config.IS_LIVE_ACTIVE,
        "products_count": len(config.ACTIVE_PRODUCTS),
        "has_ai_key": bool(config.GEMINI_API_KEY)
    }

@app.get("/webhook/fb")
async def verify_fb_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == "echo_order_verify_token":
        return Response(content=params.get("hub.challenge"))
    return Response(content="Verification failed", status_code=403)

@app.post("/webhook/fb")
async def fb_webhook(request: Request, background_tasks: BackgroundTasks):
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

        prompt = """你現在是「EchoOrder 結帳小幫手」。你的任務是從圖片或文字中【精確】提取收件資訊。
請【嚴格】回傳以下 JSON 格式：
{
  "buyer_name": "買家姓名 (規則：1. 若截圖最上方有對話對象，請優先提取。2. 若有『姓名/門市/手機』則提取姓名)",
  "phone": "10 碼電話 (如 0972907584)",
  "shipping_info": "7-11 門市資訊。規則：1. 有店號填店號。2. 包含 Google Maps 或照片則提取顯眼【店名】。3. 禁止地址。"
}
範例輸入：[包含頂部名稱 Pham Hoai 與 旗山旗力門市 的截圖]
範例輸出：{"buyer_name": "Pham Hoai", "phone": "0972907584", "shipping_info": "旗山旗力"}"""
        
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
    格式：收件人姓名, 收件人手機, 取貨門市店號, 訂單金額, 商品名稱, 收件人Email, 備註
    """
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet()
    
    # 賣貨便官方欄位
    headers = ["收件人姓名", "收件人手機", "取貨門市店號", "訂單金額", "商品名稱", "收件人Email", "備註"]
    for i, h in enumerate(headers): 
        worksheet.write(0, i, h)
    
    row = 1
    for o in ORDER_POOL.values():
        if o.created_at < config.SESSION_START_TIME: continue
        if o.status != "CONFIRMED" and o.status != "HARVESTED": continue
        
        # 1. 計算總金額 (商品 + 運費)
        total_items_price = sum((item.price or 0) * item.quantity for item in o.items)
        total_qty = sum(item.quantity for item in o.items)
        is_free = total_qty >= config.FREE_SHIPPING_THRESHOLD
        total_amount = int(round(total_items_price + (0 if is_free else config.SHIPPING_FEE)))
        
        # 2. 彙整商品名稱
        items_summary = ", ".join([f"{i.product_code}x{i.quantity}" for i in o.items])
        
        # 3. 提取 6 碼店號 (Regex 找連續 6 位數字)
        store_id = ""
        if o.shipping_info:
            import re
            match = re.search(r'\d{6}', o.shipping_info)
            if match:
                store_id = match.group(0)
            else:
                # 若找不到 6 碼店號，則保留完整資訊供賣家手動修改，不隨意切斷
                store_id = o.shipping_info
        
        worksheet.write(row, 0, o.buyer_name or o.fb_user_name)     # 收件人姓名
        worksheet.write(row, 1, o.phone or "")                      # 收件人手機
        worksheet.write(row, 2, store_id)                           # 取貨門市店號
        worksheet.write(row, 3, total_amount)                       # 訂單金額
        worksheet.write(row, 4, items_summary)                      # 商品名稱
        worksheet.write(row, 5, "")                                 # 收件人Email (空)
        worksheet.write(row, 6, o.order_id)                         # 備註 (帶入單號)
        row += 1
    
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
