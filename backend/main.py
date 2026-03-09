import re
import uuid
import unicodedata
from typing import Dict, List, Optional
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="EchoOrder Buffer Gateway")

# 允許 Next.js 前端跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🧠 數據模型
# ==========================================
class OrderItem(BaseModel):
    product_code: str
    quantity: int

class Order(BaseModel):
    order_id: str
    fb_user_id: str
    fb_user_name: str
    items: List[OrderItem]
    status: str  # PENDING, CONFIRMED, HARVESTED
    shipping_info: Optional[str] = None
    phone: Optional[str] = None
    buyer_name: Optional[str] = None

import json

# ==========================================
# 🗄️ 數據持久化 (防止重啟後資料消失)
# ==========================================
DB_FILE = "order_pool.json"

def save_orders():
    with open(DB_FILE, "w", encoding="utf-8") as f:
        # 將 Order 物件轉為 dict 存檔
        data = {k: v.dict() for k, v in ORDER_POOL.items()}
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_orders():
    global ORDER_POOL
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                ORDER_POOL = {k: Order(**v) for k, v in data.items()}
                print(f"📦 [系統] 已載入 {len(ORDER_POOL)} 筆歷史訂單")
        except Exception as e:
            print(f"⚠️ [警告] 載入資料庫失敗: {e}")

ACTIVE_PRODUCTS: Dict[str, str] = {}
ORDER_POOL: Dict[str, Order] = {}

# 啟動時載入
load_orders()

PAGE_ACCESS_TOKEN = os.getenv("PAGE_ACCESS_TOKEN", "YOUR_FB_PAGE_TOKEN")

# ==========================================
# 🛠️ 核心邏輯：解析器
# ==========================================
def normalize_text(text: str) -> str:
    """處理全形轉半形，並轉大寫"""
    return unicodedata.normalize('NFKC', text).upper()

def parse_comment(text: str) -> List[OrderItem]:
    normalized = normalize_text(text)
    # 匹配格式: A+1, B2 加 2, A + 1...
    pattern = r'([A-Z0-9]+)\s*(?:\+|加)\s*(\d+)'
    matches = re.findall(pattern, normalized)
    
    items = []
    for code, qty in matches:
        if code in ACTIVE_PRODUCTS:
            items.append(OrderItem(product_code=code, quantity=int(qty)))
    return items

async def send_messenger_link(fb_user_id: str, order_id: str, items: List[OrderItem]):
    """發送 Messenger 私訊連結"""
    # [IMPORTANT] 請更換為您部署後的正式網域
    checkout_url = f"https://light-local-mvp.vercel.app/checkout/{order_id}"
    item_summary = ", ".join([f"{i.product_code} x{i.quantity}" for i in items])
    
    message_text = (
        f"感謝您的喊單！您預定了: {item_summary}。\n"
        f"請點擊下方連結確認您的 7-11 門市與聯絡資訊，完成後訂單才算成立喔！\n"
        f"👉 {checkout_url}"
    )
    
    # 這裡實作 FB Graph API 呼叫 (範例)
    # async with httpx.AsyncClient() as client:
    #     await client.post(
    #         f"https://graph.facebook.com/v19.0/me/messages?access_token={PAGE_ACCESS_TOKEN}",
    #         json={"recipient": {"id": fb_user_id}, "message": {"text": message_text}}
    #     )
    print(f"[LOG] Sent link to {fb_user_id}: {checkout_url}")

# ==========================================
# 🌐 API 路由
# ==========================================

@app.get("/api/health")
async def health_check():
    """直播前喚醒與心跳包"""
    print("📡 [健康檢查] 前端心跳包已送達")
    return {
        "status": "alive", 
        "active_products_count": len(ACTIVE_PRODUCTS),
        "active_order_ids": list(ORDER_POOL.keys())
    }

@app.post("/api/seller/active_products")
async def sync_products(products: Dict[str, str]):
    """1. 賣家同步今日直播商品代號 (例如 {"A": "Dress_001"})"""
    global ACTIVE_PRODUCTS
    ACTIVE_PRODUCTS = products
    print(f"🔄 [字典同步] 已更新商品代號映射: {len(ACTIVE_PRODUCTS)} 筆")
    return {"status": "success", "synced_count": len(ACTIVE_PRODUCTS)}

@app.post("/webhook/fb")
async def fb_webhook(request: Request, background_tasks: BackgroundTasks):
    """2. 接收 FB 直播留言 Webhook"""
    payload = await request.json()
    
    # 解析流程 (根據 FB Payload 結構調整)
    # 範例提取:
    comment_text = payload.get("comment", "")
    fb_user_id = payload.get("sender_id", "")
    fb_user_name = payload.get("sender_name", "Unknown")
    
    valid_items = parse_comment(comment_text)
            
    if valid_items:
        order_id = f"ORD_{uuid.uuid4().hex[:8].upper()}"
        new_order = Order(
            order_id=order_id,
            fb_user_id=fb_user_id,
            fb_user_name=fb_user_name,
            items=valid_items,
            status="PENDING"
        )
        ORDER_POOL[order_id] = new_order
        save_orders()
        
        # 異步發送 Messenger，保證 Webhook 在 200ms 內回應 FB
        background_tasks.add_task(send_messenger_link, fb_user_id, order_id, valid_items)
        return {"status": "success", "order_id": order_id}
        
    return {"status": "success", "msg": "No items found"}

@app.get("/api/checkout/{order_id}")
async def get_checkout_order(order_id: str):
    """3. 客戶結帳頁面查詢"""
    print(f"📥 [結帳查詢] Order ID: {order_id}")
    if order_id not in ORDER_POOL:
        raise HTTPException(status_code=404, detail="Order not found")
    return ORDER_POOL[order_id]

@app.post("/api/checkout/{order_id}/confirm")
async def confirm_order(order_id: str, data: Dict):
    """4. 客戶提交 7-11 門市、手機與地址"""
    if order_id not in ORDER_POOL:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = ORDER_POOL[order_id]
    order.status = "CONFIRMED"
    order.shipping_info = data.get("shipping_info", "未知門市")
    order.phone = data.get("phone", "")
    order.buyer_name = data.get("buyer_name", order.fb_user_name)
    save_orders()
    return {"status": "success"}

@app.get("/api/seller/harvest")
async def harvest_orders():
    """5. 賣家手機端拉取已確認訂單 (收割)"""
    confirmed = [o for o in ORDER_POOL.values() if o.status == "CONFIRMED"]
    # 標記為已收割，避免重複扣庫存
    for o in confirmed:
        o.status = "HARVESTED"
    save_orders()
    return {"harvested_orders": confirmed}
@app.get("/api/seller/stats")
async def get_seller_stats():
    """6. 即時統計：獲取各代號的待處理與已確認數量"""
    stats = {}
    # 初始化所有 active products
    for code in ACTIVE_PRODUCTS:
        stats[code] = {"pending": 0, "confirmed": 0}
        
    for order in ORDER_POOL.values():
        # 只統計尚未收割的訂單
        if order.status in ["PENDING", "CONFIRMED"]:
            for item in order.items:
                if item.product_code in stats:
                    if order.status == "PENDING":
                        stats[item.product_code]["pending"] += item.quantity
                    else:
                        stats[item.product_code]["confirmed"] += item.quantity
    return stats
