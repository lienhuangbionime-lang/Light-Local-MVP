import re
import uuid
import time
import hashlib
from typing import Dict, List, Optional
from fastapi import BackgroundTasks
from backend.models.schemas import Order, OrderItem
import backend.config as config
from backend.database.firebase import save_orders, sync_state_from_cloud, acquire_lock, save_events
from backend.services.ai_service import ask_gemini_secretary, ask_gemma_receptionist
from backend.services.fb_service import send_messenger_link
from backend.core.security import generate_order_signature
# from backend.services.store_service import resolve_store_info  <-- Move to local import

def normalize_text(text: str) -> str:
    """處理全形轉半形，並轉大寫"""
    if not text: return ""
    import unicodedata
    return unicodedata.normalize('NFKC', text).upper()

def get_price_from_rule(rule_str: str, quantity: int) -> int:
    """從規則字串 (如 1:265, 2:475, 3:635) 解析出給定數量的總價"""
    if not rule_str or ":" not in rule_str:
        return 0
    
    try:
        # 解析規則： { 件數: 總價 }
        tiers = {}
        for part in rule_str.split(","):
            q_str, p_str = part.split(":")
            tiers[int(q_str.strip())] = int(float(p_str.strip()))
        
        if not tiers: return 0
        
        sorted_qs = sorted(tiers.keys(), reverse=True)
        total_price = 0
        remaining = quantity
        
        # 貪婪演算法：從最高件數優惠開始扣除
        # 例如規則有 3件, 2件, 1件。 4件 = 1次3件優惠 + 1次1件價格
        for q in sorted_qs:
            if remaining <= 0: break
            num_sets = remaining // q
            if num_sets > 0:
                total_price += num_sets * tiers[q]
                remaining %= q
        
        return total_price
    except Exception as e:
        print(f"[PRICING] 解析規則出錯 {rule_str}: {e}")
        return 0

def parse_comment(text: str) -> Dict:
    normalized = normalize_text(text)
    # [FIX] 支援中文字代號 (A-Z, 0-9, 以及常見中文字)
    pattern = r'([A-Za-z0-9\u4e00-\u9fa5]{1,5})\s*([^\w\s]|[\+\uff0b\u2795])+\s*(\d+)'
    matches = re.findall(pattern, normalized)
    
    items = []
    has_unknown_code = False
    
    for code, _sep, qty in matches:
        if code in config.ACTIVE_PRODUCTS:
            items.append(OrderItem(product_code=code, quantity=int(qty)))
        else:
            has_unknown_code = True
            msg = f"[PARSER] 拒絕代碼 {code}: 不在目前字典中 (可用: {list(config.ACTIVE_PRODUCTS.keys())})"
            print(msg)
            if config.LAST_EVENTS:
                config.LAST_EVENTS[0]["rejection"] = msg
    
    return {"items": items, "has_unknown_code": has_unknown_code}

async def process_order(message_text: str, user_id: str, user_name: str, background_tasks: BackgroundTasks, comment_id: Optional[str] = None, token: Optional[str] = None, base_url: str = ""):
    """內部邏輯：解析指令、建立訂單、發送私訊"""
    if not user_id or not message_text:
        return {"status": "error", "msg": "Invalid input"}

    if comment_id and comment_id in config.PROCESSED_COMMENT_IDS:
        return {"status": "already_processed"}
    
    if comment_id and comment_id in config.CURRENTLY_PROCESSING_IDS:
        return {"status": "processing"}

    if comment_id:
        if not await acquire_lock(comment_id):
            config.PROCESSED_COMMENT_IDS.add(comment_id)
            return {"status": "already_processed"}

    if comment_id:
        config.CURRENTLY_PROCESSING_IDS.add(comment_id)

    try:
        parsing_result = parse_comment(message_text)
        if parsing_result.get("has_unknown_code"):
            await sync_state_from_cloud(force=True)
            parsing_result = parse_comment(message_text)

        valid_items = parsing_result["items"]
        
        if valid_items:
            # --- [AI ENHANCEMENT] 嘗試從完整訊息中提取 姓名/手機/門市 (MyShip 格式) ---
            potential_contact_info = False
            # 判斷是否包含斜線或長度較長 (可能包含姓名/手機/門市)
            if "/" in message_text or len(message_text) > 15:
                potential_contact_info = True
            
            buyer_name = user_name
            phone = None
            shipping_info = None

            if potential_contact_info:
                print(f"[AI] 偵測到複雜留言，試圖提取聯絡資訊: {message_text}")
                # 呼叫秘書 AI 進行解析
                extracted = await ask_gemini_secretary(message_text)
                if extracted and isinstance(extracted, dict):
                    buyer_name = extracted.get("buyer_name") or user_name
                    phone = extracted.get("phone")
                    raw_shipping = extracted.get("shipping_info")
                    
                    if raw_shipping:
                        from backend.services.store_service import resolve_store_info
                        shipping_info = await resolve_store_info(raw_shipping)
                    
                    if phone:
                        # 清理非數字內容
                        phone = "".join(filter(str.isdigit, str(phone)))
            
            # -------------------------------------------------------------------

            for item in valid_items:
                code_upper = item.product_code.upper()
                product_data = config.ACTIVE_PRODUCTS.get(code_upper, "未知商品")
                
                if isinstance(product_data, dict):
                    item.product_name = product_data.get("name", "未命名商品")
                    price_rule = product_data.get("price_rule", "")
                    total_p = get_price_from_rule(price_rule, item.quantity)
                    item.price = total_p / item.quantity if item.quantity > 0 else 0.0
                else:
                    item.product_name = product_data
                    item.price = 0

            if comment_id:
                deterministic_id = hashlib.md5(comment_id.encode()).hexdigest()[:8].upper()
                order_id = f"ORD_{deterministic_id}"
            else:
                order_id = f"ORD_{uuid.uuid4().hex[:8].upper()}"

            new_order = Order(
                order_id=order_id,
                fb_user_id=user_id,
                fb_user_name=user_name,
                buyer_name=buyer_name,  # 優先使用 AI 提取的姓名
                phone=phone,            # AI 提取的手機
                shipping_info=shipping_info, # AI 提取的門市 (已校正)
                items=valid_items,
                status="PENDING",
                source_comment_id=comment_id,
                instance_id=config.INSTANCE_ID,
                created_at=time.time()
            )
            config.ORDER_POOL[order_id] = new_order
            
            if comment_id:
                config.PROCESSED_COMMENT_IDS.add(comment_id)
            
            await save_orders(save_config=True, fields=["processed_comment_ids"], order_id=order_id)
            background_tasks.add_task(send_messenger_link, user_id, order_id, valid_items, comment_id, token, base_url)
            return {"status": "success", "msg": f"Order {order_id} created", "order_id": order_id}
        
        if parsing_result["has_unknown_code"]:
            if comment_id: config.PROCESSED_COMMENT_IDS.add(comment_id)
            return {"status": "missing_code", "msg": "Matches found but codes are not in pool", "raw": message_text}
            
        return {"status": "no_match", "msg": "No valid product codes found in comment"}
    finally:
        if comment_id and comment_id in config.CURRENTLY_PROCESSING_IDS:
            config.CURRENTLY_PROCESSING_IDS.remove(comment_id)

async def handle_admin_secretarial_work(webhook_data: dict, background_tasks: BackgroundTasks, target_psid_override: Optional[str] = None):
    """處理管理員轉傳來的秘書工作 (修正後的正確入口)"""
    # 從 Webhook 資料中提取必要資訊 (假設是傳入 entry[0].messaging[0])
    entry = webhook_data.get("entry", [{}])[0]
    messaging = entry.get("messaging", [{}])[0]
    
    sender_id = messaging.get("sender", {}).get("id")
    message_data = messaging.get("message", {})
    text_content = message_data.get("text")
    attachments = message_data.get("attachments", [])
    
    # 決定誰是真正的目標客戶 (客戶 PSID)
    # 如果是管理員回覆 (target_psid_override 有值)，則目標是該 recipient
    target_psid = target_psid_override if target_psid_override else sender_id
    
    # 判斷是否有圖片
    has_image = any(a.get("type") == "image" for a in attachments)
    
    # 0. 關鍵字過濾：如果是要求「統計」或「名單」
    if text_content and any(kw in text_content for kw in ["統計", "名單", "整理", "報表"]):
        all_confirmed = [o for o in config.ORDER_POOL.values() if o.status == "CONFIRMED" and o.created_at >= config.SESSION_START_TIME]
        if not all_confirmed:
            await send_messenger_link(sender_id, "None", [], text="秘書報告：目前還沒有「已完成填單 (CONFIRMED)」的訂單喔！")
            return
            
        # 依照 buyer_name + phone 分組
        groups = {}
        for o in all_confirmed:
            key = f"{o.buyer_name}_{o.phone}"
            if key not in groups:
                groups[key] = {"name": o.buyer_name, "phone": o.phone, "shipping": o.shipping_info, "items": []}
            groups[key]["items"].extend(o.items)
            
        summary_data = []
        for g in groups.values():
            item_list = ", ".join([f"{i.product_code}x{i.quantity}" for i in g["items"]])
            summary_data.append(f"- 【{g['name']}】({g['phone']}): {item_list} @ {g['shipping']}")
            
        data_str = "\n".join(summary_data)
        prompt = f"""你是一位專業的「直播訂單統計官」。請將下方的原始訂單數據整理成一份漂亮、易讀的摘要報表。
        報表應包含：
        1. 買家清單 (包含購買品項與總數)
        2. 運費狀態提醒 (滿 {config.FREE_SHIPPING_THRESHOLD} 件免運，否則運費為 ${config.SHIPPING_FEE})
        3. 總人數統計
        4. (選填) 提醒賣家哪些訂單已達標免運，哪些還差幾件。
        用溫馨、專業的口吻回覆。
        
        數據：
        {data_str}"""
        
        report = await ask_gemini_secretary(text_content="[SUMMARY REQUEST]", system_prompt=prompt)
        report_text = report.get("answer") if (isinstance(report, dict) and "answer" in report) else str(report)
        if not report_text or report_text == "{}" or report_text == "None":
            report_text = f"🤖 秘書統計報表：\n\n{data_str}\n\n(註：以上為原始數據，AI 整理中...)"

        await send_messenger_link(sender_id, "None", [], text=report_text)
        return

    # 1. 前置處理與圖片下載
    image_b64 = None

    # --- 第二階段：判斷是否需要提升至 Gemini 主管 (高智慧 / 訂單解析 / 圖片掃描) ---
    # 修正：之前這裡有個 undefined 的 recep_reply，現在只要有文字或圖片就嘗試解析
    should_escalate = has_image or (text_content and len(text_content.strip()) > 0)
    
    if not should_escalate:
        return

    # 下載圖片 (如果有)
    import httpx
    import base64
    image_b64 = None
    for attach in attachments:
        if attach.get("type") == "image":
            img_url = attach.get("payload", {}).get("url")
            if img_url:
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(img_url)
                        if resp.status_code == 200:
                            image_b64 = base64.b64encode(resp.content).decode("utf-8")
                except Exception as e:
                    print(f"[AI] 下載圖片失敗: {e}")
            break

    user_history_str = ""
    target_user_id = target_psid if target_psid else sender_id
    recent_orders = [o for o in config.ORDER_POOL.values() if o.fb_user_id == target_user_id and (time.time() - o.created_at) < 600]
    if recent_orders:
        history_lines = [f"- 單號: {o.order_id}, 內容: {', '.join([f'{i.product_code}x{i.quantity}' for i in o.items])}" for o in recent_orders]
        user_history_str = "\n".join(history_lines)

    # 呼叫 Gemini 主管
    extracted = await ask_gemini_secretary(text_content, image_b64, history=user_history_str)
    
    if extracted:
        buyer_name = extracted.get("buyer_name") or "AI 辨識客戶"
        phone = extracted.get("phone")
        raw_shipping = extracted.get("shipping_info", "")
        
        # 進行門市代號與名稱校正 (使用區域導入以防循環引用)
        from backend.services.store_service import resolve_store_info
        shipping = await resolve_store_info(raw_shipping)
        
        ai_items = extracted.get("items", [])
        
        valid_items = []
        has_missing = False
        for ai_item in ai_items:
            code = str(ai_item.get("product_code", "")).upper()
            qty = ai_item.get("quantity", 1)
            if code in config.ACTIVE_PRODUCTS:
                p_data = config.ACTIVE_PRODUCTS[code]
                p_name = p_data.get("name", code) if isinstance(p_data, dict) else p_data
                p_rule = p_data.get("price_rule", "") if isinstance(p_data, dict) else ""
                
                total_p = get_price_from_rule(p_rule, qty)
                unit_p = total_p / qty if qty > 0 else 0.0
                valid_items.append(OrderItem(product_code=code, quantity=qty, product_name=p_name, price=unit_p))
            else:
                has_missing = True
                valid_items.append(OrderItem(product_code=code, quantity=qty, product_name=f"(AI推測) {code}"))
        
        if has_missing:
            await sync_state_from_cloud(force=True)
            for item in valid_items:
                if item.product_name.startswith("(AI推測)") and item.product_code in config.ACTIVE_PRODUCTS:
                    item.product_name = config.ACTIVE_PRODUCTS[item.product_code]

        if not valid_items:
            if not target_psid:
                await send_messenger_link(sender_id, "None", [], text="秘書報告：AI 沒看到明顯的商品代號，請確認內容。")
            return

        content_fingerprint = hashlib.md5(f"{sender_id}:{text_content or ''}:{buyer_name}:{phone or ''}".encode()).hexdigest()[:12].upper()
        actual_user_id = target_psid if target_psid else f"ADMIN_{sender_id[-4:]}"

        for existing_order in config.ORDER_POOL.values():
            if existing_order.order_id.startswith(f"AI_{content_fingerprint}"):
                if not target_psid:
                    await send_messenger_link(sender_id, existing_order.order_id, existing_order.items, text=f"秘書提示：這筆資料剛剛已經建檔過了喔！\n單號: {existing_order.order_id}")
                return

        if extracted.get("is_duplicate"):
            if not target_psid:
                await send_messenger_link(sender_id, "None", [], text="🤖 秘書提示：您剛才好像傳過了相同的內容，為了避免重複下單，這筆我就先不建檔囉！")
            return

        order_id = f"AI_{content_fingerprint}"
        new_order = Order(
            order_id=order_id,
            fb_user_id=actual_user_id,
            fb_user_name=buyer_name,
            items=valid_items,
            status="CONFIRMED" if (phone and shipping) else "PENDING",
            shipping_info=shipping,
            phone=phone,
            buyer_name=buyer_name,
            instance_id=config.INSTANCE_ID,
            created_at=time.time()
        )
        
        config.ORDER_POOL[order_id] = new_order
        await save_orders(order_id=order_id)
        
        summary = "\n".join([f"- {i.product_code} x{i.quantity} ({i.product_name})" for i in valid_items])
        
        # 準備結帳連結
        signature = generate_order_signature(order_id)
        checkout_url = f"https://light-local-mvp.vercel.app/checkout/{order_id}?s={signature}"
        
        if target_psid:
            # 1. 傳送回饋給管理員 (告知解析成功)
            admin_reply = f"🤖 秘書自動補單 (對象: {buyer_name})\n單號: {order_id}\n解析成功！已反映至直播系統。\n🔗 結帳連結：{checkout_url}"
            await send_messenger_link(sender_id, "None", [], text=admin_reply)
            
            # 2. 自動傳送連結給客戶 (這才是真正關鍵)
            customer_reply = f"您好 {buyer_name}，AI 秘書已為您建立訂單：\n{summary}\n\n👉 請點擊下方連結確認您的 7-11 門市資訊：\n{checkout_url}"
            await send_messenger_link(target_psid, order_id, valid_items, text=customer_reply)
            
            config.LAST_EVENTS.insert(0, {"time": "AI_OK", "content": f"🤖 秘書自動補單且已傳送連結給: {buyer_name}"})
            await save_events()
        else:
            # 純管理員模式 (沒有目標 PSID)
            reply_text = f"✅ 秘書已建檔 (單號: {order_id})\n客戶：{buyer_name}\n品項：\n{summary}\n\n👉 結帳連結：\n{checkout_url}"
            await send_messenger_link(sender_id, order_id, valid_items, text=reply_text)
