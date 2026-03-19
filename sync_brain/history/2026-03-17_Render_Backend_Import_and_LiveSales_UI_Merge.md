## 2026-03-17 問題紀錄：Render 後端 import 失敗 + 直播/銷售頁整合

### A. Render 後端 `No module named 'backend'`

#### 症狀
- Render log 出現：
  - `ModuleNotFoundError: No module named 'backend'`
  - Gunicorn worker failed to boot

#### 根因
- Render 服務設定：
  - **Root Directory = `backend`**
  - Start command 用 `gunicorn main:app ...`
- 當 Root Directory 設為 `backend` 時，Python 執行環境的工作目錄變成 `.../backend`。
  - 此時 `from backend.config import ...` 會嘗試在 `backend/backend/...` 找套件，容易失敗（即使 repo 內有 `backend/__init__.py`）。
- 另有一個部署風險：
  - Start command 綁死 `--bind 0.0.0.0:10000`，但 Render 需要綁 `$PORT`。

#### 建議修正（推薦）
- **Root Directory：留空**（讓 Render 從 repo root 啟動）
- **Build Command**：
  - `pip install -r backend/requirements.txt`
- **Start Command**：
  - `gunicorn -k uvicorn.workers.UvicornWorker backend.main:app --bind 0.0.0.0:$PORT`
- 部署時建議使用「Clear build cache & deploy」避免快取舊 commit。

#### 次佳修正（若堅持 Root Directory=backend）
- **Root Directory = `backend`** 時，Start command 必須是：
  - `gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
- 但此路徑更容易因為 import 模組路徑不一致而反覆出問題，不建議作為長期方案。

---

### B. 本機埠號不一致造成前端「紅色框但沒字」

#### 症狀
- 直播頁「同步字典」/「收割」按下去只看到一整塊紅色提示區塊，沒有可讀文字（實際是 destructive toast）。

#### 根因
- 後端實際在 `http://127.0.0.1:8000` 跑，但工具/前端配置仍可能指向 `10000` 或 Render URL。

#### 已做的修正
- `backend/simulate_fb.py`：
  - `BASE_URL` 改成 `http://127.0.0.1:8000`，避免打錯埠號導致連線失敗。

#### 建議驗證
- 前端設定頁 `backendUrl` 必須填：
  - `http://127.0.0.1:8000`
- 後端健康檢查：
  - `GET http://127.0.0.1:8000/api/health`

---

### C. 直播 x 銷售：UI 合併策略（結論）

#### 需求結論
- 「直播」頁應該只負責 **設定（代號字典/價格）** 與 **同步字典**。
- 「收割」與「銷售」屬同類型：都是「扣庫存 + 寫入銷售紀錄」。
- 因此：
  - **訂單/收割清單移到「銷售」頁**，直播頁避免塞太多結算流程。

#### 已落地的方向（狀態）
- `Sale` 已有 `source` / `liveSessionId`，可在銷售頁篩選「直播」vs「一般」。
- 銷售頁加入「直播收割（已確認訂單）」入口：
  - 按鈕會呼叫 `/api/seller/harvest` → `harvestLiveOrders(...)` → 扣庫存並寫 `sales`。
- 直播頁移除「自動收割」邏輯（避免在直播頁輪詢時直接扣庫存）。

---

### D. UI：危險操作按鈕過度紅底

#### 症狀
- 設定頁「清空所有本地資料」確認框的按鈕呈現大片紅底，視覺過度刺眼。

#### 修正方向
- 改成「白底 + 紅色邊框/文字」，保留危險語意但不整片紅。

