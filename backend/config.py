import os
import random
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

# [SECURITY] Admin HMAC Secret
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "".join(random.choices("0123456789abcdef", k=16)))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
PAGE_ACCESS_TOKEN = os.getenv("PAGE_ACCESS_TOKEN", "")
GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-2-preview"
GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "models/gemma-4-31b-it")

# [SYSTEM] Identifiers
INSTANCE_ID = "".join(random.choices("0123456789abcdef", k=8))
CURRENT_PAGE_ID = ""
CURRENT_LIVE_VIDEO_ID = ""

# [STATE] Global State (In-memory)
ORDER_POOL = {}
ACTIVE_PRODUCTS = {}
LAST_EVENTS = []
PROCESSED_COMMENT_IDS = set()
CURRENTLY_PROCESSING_IDS = set()
SESSION_START_TIME = 0.0
IS_LIVE_ACTIVE = False
FREE_SHIPPING_THRESHOLD = 3
SHIPPING_FEE = 38 # 舊版保留
BUYER_SHIPPING_FEE = 50       # 預設自訂運費 (收買家的)
PLATFORM_SHIPPING_FEE = 38    # 預設平台運費 (賣貨便收取的)
CONFIG_CACHE = {"last_sync": 0}

# [CONNECTION] Global HTTP Client
global_client = httpx.AsyncClient(timeout=60.0)

# [PATHS]
FIREBASE_KEY_PATH = "serviceAccountKey.json"
FB_CONFIG_PATH = "fb_config.json"
