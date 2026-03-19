import sys
import os

# 確保專案根目錄在 PYTHONPATH 中，使 backend 包可以被正確引用
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 從模組化的後端導入 FastAPI 實例
from backend.main import app

# 這使得 Render 的啟動指令 "uvicorn main:app" 依然有效
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
