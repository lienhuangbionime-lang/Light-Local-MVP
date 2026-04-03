# ⚡ MuMu Apparel - Backend (Python FastAPI)

這是一個為 **MuMu Apparel (沐沐服飾)** 打造的輕量化後端，專注於直播收單、AI 圖片辨識與 7-11 物流整合。

## 🏗️ 系統架構 (System Architecture)

- **核心框架**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **資料庫**: [Firebase Firestore](https://firebase.google.com/docs/firestore) (與前端同步真理)
- **AI 引擎**: [Google Gemini Vision Pro](https://ai.google.dev/) (辨識收據與圖片)
- **部署環境**: [Render](https://render.com/) (雲端) / 本地 Windows (開發)

## 📂 資料夾結構 (Project Structure)

```text
backend/
├── main.py              # 進入點 (CORS, 路由掛載)
├── core/                # 核心配置與安全性
│   └── config.py        # 全域變數與 API Keys
├── database/            # 資料庫層
│   └── firebase.py      # Firestore 封裝
├── models/              # 資料模型 (Pydantic Models)
├── services/            # 業務邏輯層
│   ├── ai_service.py    # Gemini Vision 辨識邏輯
│   ├── store_service.py # 7-11 門市協同辨識 (Synergy Fix)
│   ├── fb_service.py    # Facebook Webhook 處理
│   └── order_service.py # 訂單歸檔與結帳處理
```

## 🚀 核心技術亮點 (Technical Highlights)

### 1. 7-11 門市協同辨識 (Synergy Model)
為解決 AI 偶爾會被發票號碼或噪音數字 (如 `206950`) 誤導的問題，我們實作了**「AI 發現 + Python 驗證」**:
- **店名優先**: 若圖片中包含確切店名 (如: 圓興)，其優先級高於純數字店號。
- **實體驗證**: 所有提取出的 6 位數 ID 均會與 `stores_cloud.json` 進行嚴格比對。

### 2. 直播收單引擎
- **v25.0 Webhook**: 穩定接接 FaceBook 直播留言。
- **秒級歸檔**: 訂單確認後自動從 Staging 區移動至 Result 區。

## 🛠️ 本地開發 (Local Development)

### 1. 安裝依賴
```powershell
pip install -r requirements.txt
```

### 2. 環境變數設定
請在 `core/config.py` 或系統環境變數中設定：
- `FB_PAGE_TOKEN`: 臉書粉專 Token
- `GEMINI_API_KEY`: Google AI Studio Key
- `FIREBASE_CRED_PATH`: Firebase 憑證路徑

### 3. 啟動伺服器
```powershell
# 推薦使用 OpenClaw Launcher
.\launch-control.ps1
```

## ☁️ 雲端部署 (Render)

- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **注意事項**: 由於 Render 免費版會休眠，首次請求可能會有 30-50 秒延遲。

---
**Last Updated**: 2026-04-04 | **Status**: 7-11 Recognition Synergy Finalized
