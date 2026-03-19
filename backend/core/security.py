import hmac
import hashlib
import time
from backend.config import ADMIN_SECRET

def verify_admin_signature(signature: str, timestamp: str) -> bool:
    """驗證前端 Admin 傳來的簽名 (有效時間 5 分鐘)"""
    if not signature or not timestamp: return False
    try:
        ts = float(timestamp)
        now = time.time()
        if abs(now - ts) > 300: # 5 分鐘
            return False
            
        expected = hmac.new(
            ADMIN_SECRET.encode(),
            f"admin:{timestamp}".encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False

def generate_order_signature(order_id: str) -> str:
    """為結帳連結生成專屬簽名，防止單號竄改"""
    return hmac.new(
        ADMIN_SECRET.encode(),
        f"order:{order_id}".encode(),
        hashlib.sha256
    ).hexdigest()[:12]

def verify_order_signature(order_id: str, signature: str) -> bool:
    """驗證結帳連結簽名"""
    if not signature: return False
    return hmac.compare_digest(signature, generate_order_signature(order_id))
