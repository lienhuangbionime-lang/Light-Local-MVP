import os
import httpx
import json
from typing import List, Optional, Dict
from fastapi import BackgroundTasks
from backend.models.schemas import OrderItem
import backend.config as config
from backend.core.security import generate_order_signature
from backend.database.firebase import save_events

def load_fb_config():
    if os.path.exists(config.FB_CONFIG_PATH):
        try:
            with open(config.FB_CONFIG_PATH, "r") as f:
                return json.load(f)
        except:
            pass
    return {}

def save_fb_config(fb_config):
    with open(config.FB_CONFIG_PATH, "w") as f:
        json.dump(fb_config, f)

async def send_messenger_link(fb_user_id: str, order_id: str, items: List[OrderItem], comment_id: Optional[str] = None, token: Optional[str] = None, base_url: str = "", text: Optional[str] = None):
    """發送 Messenger 私訊連結 (支援動態後端溯源)"""
    checkout_url = f"https://light-local-mvp.vercel.app/checkout/{order_id}"
    if base_url:
        signature = generate_order_signature(order_id)
        checkout_url = f"https://light-local-mvp.vercel.app/checkout/{order_id}?backend={base_url}&s={signature}"
    
    item_summary = ", ".join([f"{i.product_code} x{i.quantity}" for i in items])
    
    if not token:
        token = (config.PAGE_ACCESS_TOKEN or load_fb_config().get("fb_page_token", ""))
    
    if not token or token == "YOUR_FB_PAGE_TOKEN":
        print(f"[MESSENGER] 跳過發送：未設定有效的 PAGE_ACCESS_TOKEN")
        return

    final_text = text if text else (
        f"感謝您的喊單！您預定了: {item_summary}。\n"
        f"請點擊下方連結確認您的 7-11 門市與聯絡資訊，完成後訂單才算成立喔！\n"
        f"👉 {checkout_url}"
    )
    
    msg_api_ver = "v25.0"
    try:
        if comment_id:
            test_ids = [comment_id]
            if "_" in comment_id:
                short_id = comment_id.split("_")[-1]
                test_ids.append(f"{config.CURRENT_PAGE_ID}_{short_id}")
                test_ids.append(short_id)
            
            success = False
            last_err = ""
            for tid in test_ids:
                url = f"https://graph.facebook.com/{msg_api_ver}/{tid}/private_replies"
                res = await config.global_client.post(url, json={"message": final_text}, params={"access_token": token})
                if res.status_code == 200:
                    print(f"[MESSENGER] PRIVATE_REPLY 成功 (ID: {tid})")
                    config.LAST_EVENTS.insert(0, {"time": "ok", "content": f"✅ 私訊發送成功 (ID: {tid})"})
                    success = True
                    break
                else:
                    last_err = res.text
            
            if success:
                if len(config.LAST_EVENTS) > 20: del config.LAST_EVENTS[20:]
                await save_events()
                return

        # Fallback: MESSAGES_API
        url = f"https://graph.facebook.com/{msg_api_ver}/me/messages?access_token={token}"
        payload = {"recipient": {"id": fb_user_id}, "message": {"text": final_text}}
        res = await config.global_client.post(url, json=payload, timeout=10.0)
        
        if res.status_code == 200:
            config.LAST_EVENTS.insert(0, {"time": "ok", "content": f"✅ 一般私訊成功 ({fb_user_id})"})
        else:
            err_msg = res.json().get("error", {}).get("message", res.text) if res.text else "No response body"
            config.LAST_EVENTS.insert(0, {"time": "err", "content": f"❌ 私訊失敗 for {fb_user_id[-4:]}: {err_msg[:50]}"})
        
        if len(config.LAST_EVENTS) > 20: del config.LAST_EVENTS[20:]
        await save_events()

    except Exception as e:
        print(f"[MESSENGER] 系統崩潰: {e}")
        config.LAST_EVENTS.insert(0, {"time": "err", "content": f"🔥 私訊系統崩潰: {str(e)[:50]}"})
        await save_events()

async def subscribe_page_to_app(token: str):
    """強製要求 Facebook 將 Page 的事件發送到此 Webhook"""
    async with httpx.AsyncClient() as client:
        try:
            me_res = await client.get(f"https://graph.facebook.com/v25.0/me?fields=name,id&access_token={token}")
            me_data = me_res.json()
            page_name = me_data.get('name')
            
            url = f"https://graph.facebook.com/v25.0/me/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks&access_token={token}"
            res = await client.post(url)
            res_data = res.json()
            
            if res.status_code == 200:
                config.CURRENT_PAGE_ID = me_data.get('id', "")
                print(f"[FB] Page ID captured: {config.CURRENT_PAGE_ID}")
                from backend.database.firebase import save_orders
                await save_orders(save_config=True, fields=["fb_page_id"])
            
            return {"success": res.status_code == 200, "page_name": page_name, "original": res_data, "page_id": config.CURRENT_PAGE_ID}
        except Exception as e:
            return {"success": False, "message": str(e)}

async def process_webhook_data(data: Dict, background_tasks: BackgroundTasks, is_simulated: bool = False):
    """橫跨真實 Webhook 與模擬測試的核心處理邏輯"""
    from backend.database.firebase import sync_state_from_cloud, save_events
    from backend.services.order_service import process_order, handle_admin_secretarial_work
    import uuid

    await sync_state_from_cloud()

    event_time = f"SIM_{uuid.uuid4().hex[:4]}" if is_simulated else uuid.uuid4().hex[:6]
    content_preview = None
    try:
        if "entry" in data and len(data["entry"]) > 0:
            entry = data["entry"][0]
            if "changes" in entry and len(entry["changes"]) > 0:
                change = entry["changes"][0]
                content_preview = change.get("value", {}).get("message")
            elif "messaging" in entry and len(entry["messaging"]) > 0:
                msg = entry["messaging"][0]
                content_preview = msg.get("message", {}).get("text")
    except Exception:
        pass

    config.LAST_EVENTS.insert(0, {
        "time": event_time, 
        "data": data,
        "content": content_preview or (data.get("object") if not is_simulated else "Simulation")
    })
    if len(config.LAST_EVENTS) > 20: del config.LAST_EVENTS[20:]
    
    base_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("RENDER_EXTERNAL_HOSTNAME") or os.getenv("VERCEL_URL") or ""
    if base_url and not base_url.startswith("http"):
        base_url = f"https://{base_url}"

    if "entry" in data:
        for entry in data["entry"]:
            if "changes" in entry:
                for change in entry["changes"]:
                    value = change.get("value", {})
                    if change.get("field") == "feed" and value.get("item") == "comment":
                        comment_text = value.get("message", "")
                        fb_user_id = value.get("from", {}).get("id", "")
                        fb_user_name = value.get("from", {}).get("name", "Unknown")
                        comment_id = value.get("comment_id", "")

                        if fb_user_id == config.CURRENT_PAGE_ID:
                            continue

                        await process_order(comment_text, fb_user_id, fb_user_name, background_tasks, comment_id, token=None, base_url=base_url)
            
            elif "messaging" in entry:
                for msg_event in entry["messaging"]:
                    sender_id = msg_event.get("sender", {}).get("id")
                    recipient_id = msg_event.get("recipient", {}).get("id")
                    message_data = msg_event.get("message", {})
                    msg_text = message_data.get("text", "")
                    attachments = message_data.get("attachments", [])
                    mid = message_data.get("mid")

                    if message_data.get("is_echo"):
                        continue

                    if sender_id == config.CURRENT_PAGE_ID:
                        if attachments:
                            background_tasks.add_task(handle_admin_secretarial_work, data, background_tasks, recipient_id)
                        elif msg_text:
                            await process_order(msg_text, recipient_id, "Messenger User", background_tasks, mid, token=None, base_url=base_url)
                        continue

                    if attachments:
                        background_tasks.add_task(handle_admin_secretarial_work, data, background_tasks)
                    else:
                        await process_order(msg_text, sender_id, "Messenger User", background_tasks, mid, token=None, base_url=base_url)

    await save_events()
    return {"status": "success", "simulated": is_simulated}

async def pull_live_comments(token: str, background_tasks: BackgroundTasks):
    """主動從 FB Graph API 拉取直播留言 (支援 Polling 模式)"""
    if not token or token == "YOUR_FB_PAGE_TOKEN":
        token = config.PAGE_ACCESS_TOKEN
    
    if not token:
        return {"status": "error", "message": "Missing Page Access Token"}

    try:
        # 1. 尋找最近的直播影片 ID
        video_id = await get_latest_live_video_id(token)
        if not video_id:
            return {"status": "no_active_live", "new_orders": 0}

        # 2. 抓取留言 (這裏取最新的 100 筆即可，因為主要是補漏)
        # 排除自己的留言，並按照時間排序
        url = f"https://graph.facebook.com/v25.0/{video_id}/comments"
        params = {
            "access_token": token,
            "order": "reverse_chronological",
            "limit": 100,
            "fields": "from,message,created_time,id"
        }
        res = await config.global_client.get(url, params=params)
        if res.status_code != 200:
            return {"status": "error", "message": f"FB API Error: {res.text}"}
        
        data = res.json()
        comments = data.get("data", [])
        
        from backend.services.order_service import process_order
        import datetime
        
        new_count = 0
        base_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("RENDER_EXTERNAL_HOSTNAME") or os.getenv("VERCEL_URL") or ""
        if base_url and not base_url.startswith("http"):
            base_url = f"https://{base_url}"

        for comment in comments:
            c_id = comment.get("id")
            c_text = comment.get("message", "")
            from_data = comment.get("from", {})
            user_id = from_data.get("id")
            user_name = from_data.get("name", "Unknown")
            
            # 轉換時間
            # FB: 2024-03-18T12:34:56+0000
            created_at_dt = datetime.datetime.strptime(comment.get("created_time").split("+")[0], "%Y-%m-%dT%H:%M:%S")
            created_at_ts = created_at_dt.replace(tzinfo=datetime.timezone.utc).timestamp()

            # 檢查是否為舊留言
            if created_at_ts < config.SESSION_START_TIME:
                continue
            
            # 檢查是否已處理
            if c_id in config.PROCESSED_COMMENT_IDS:
                continue
            
            # 避開自己的留言
            if user_id == config.CURRENT_PAGE_ID:
                continue

            # 處理訂單
            result = await process_order(c_text, user_id, user_name, background_tasks, c_id, token=token, base_url=base_url)
            if result.get("status") == "success":
                new_count += 1
        
        return {"status": "success", "new_orders": new_count, "checked_count": len(comments)}

    except Exception as e:
        print(f"[FB_PULL] Error: {e}")
        return {"status": "error", "message": str(e)}

async def get_latest_live_video_id(token: str):
    """找出該 Page 目前正在直播或最近的一個 Video ID"""
    try:
        # 先找正在直播的 (status=LIVE)
        url = f"https://graph.facebook.com/v25.0/me/live_videos"
        params = {"access_token": token, "status": "LIVE", "limit": 1}
        res = await config.global_client.get(url, params=params)
        data = res.json()
        if data.get("data"):
            return data["data"][0].get("id")
        
        # 如果沒有，找最近的所有影片 (不分直播)
        url = f"https://graph.facebook.com/v25.0/me/videos"
        params = {"access_token": token, "limit": 1}
        res = await config.global_client.get(url, params=params)
        data = res.json()
        if data.get("data"):
            return data["data"][0].get("id")
            
        return None
    except Exception:
        return None
