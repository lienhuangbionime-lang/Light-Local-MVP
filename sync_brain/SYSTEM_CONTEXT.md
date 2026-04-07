# [ROLE: DEVELOPMENT CONSTITUTION]
# [FOR: Development AIs & Architects]

# 取貨記帳系統 - 極簡本地架構 (Ultra-Light Local MVP) 👔

> **Purpose**: 此文件為專案的 **Single Source of Truth**。在開始任何開發前必讀。此專案已正式從 LifeOS 轉向服飾業進銷存 MVP。

---

## 🎯 Project Identity
- **Name**: 取貨記帳系統 (Local-First MVP)
- **Philosophy**: 極簡、極速、隱私優先 (無伺服器資料庫，不儲存照片實體)。
- **Architecture**: Next.js (App Router) + Zustand (LocalStorage Persist) + 外部 AI (Gemini Vision)。
- **Target Audience**: 服飾零售/批發/代購業者。

## 🏗️ 核心架構 (The Architecture)
1. **Frontend (Client)**: 
   - ⚛️ Next.js Client Components
   - 🧠 Zustand (前端全域狀態管理) + `persist` 中介軟體自動存入 `LocalStorage`。
   - 🎨 Tailwind CSS + Shadcn UI
2. **Backend (Server)**: 
   - ⚡ Next.js API Routes (`/api/ocr`) 作為安全代理，隱藏 API Key。
3. **AI Service**: 
   - 🌍 Google Gemini Vision API (進行圖片單據辨識)。

## 📐 核心業務流程 (服飾業優化版)
- **M1 總覽看板 (Dashboard)**: 檢視庫存總值、利潤、銷售概覽。
- **M2 批次匯率鎖定 (Batch)**: 建立進貨批次 (如：越南春季批貨) 並手動鎖定當次換匯匯率。該批次單據皆綁定此匯率。
- **M3 單據辨識 (Digitize)**: 拍照上傳單據 -> API -> Gemini -> 辨識出 [品項, 外幣單價] -> 丟棄圖片實體 -> 套用 M2 匯率計算台幣初估成本 -> 存入 LocalStorage。
- **M4 物流攤提 (Shipments)**: 國際運費攤提。支援「按件數均攤」或「按重量比例攤提」(服飾業特性：飾品輕/大衣重)。算出精準「最終單位成本 (Landed Cost)」。
- **M5 庫存管理 (Inventory)**: 查詢、編輯商品庫存量與成本。
- **M6 銷售與歸檔 (Sales & Archiving)**: 
  - **分段存儲**: 活躍連結存於 `/orders` (Staging)，買家確認後立刻移入 `/archived_orders` (Result)。
  - **累計併單**: 封存區支援跨場次長期累積，Excel 匯出時才執行全量對帳。
- **M7 設定與物流 (Logistics & Settings)**: 
  - **三員合一**: 併單規則為 (電話 + 門市 + 姓名) 完全相符。
  - **自定義運費**: 提供 `BUYER_SHIPPING_FEE` (預設 50) 與 `PLATFORM_SHIPPING_FEE` (預設 38) 配置。
  - **金額拆分**: Excel 導出時自動執行 `(總額 - 平台費)` 與 `平台費` 的拆分邏輯。
  - **巨集防護**: 使用 `openpyxl` 確保 `.xlsm` 模板功能與 7-11 匯入巨集不受損。

## 🚦 開發原則與限制
- **本地優先 與 Firebase 同步**: 專案採用 `Firebase Firestore` 作為跨設備資料同步與門市資料庫的核心真理。
- **純本地操作體驗**: 前端業務狀態應優先在 `LocalStorage` 緩存/持久化，確保離線可用性與極致流暢度。
- **圖片「閱後即焚」**: 圖片送到 `/api/ocr` 辨識完畢後，即刻丟棄，不可存入 LocalStorage 或 Firestore，避免儲存負擔。
- **狀態管理**: 全域狀態集中在 `Zustand`，並依據欄位屬性決定是存於 `LocalStorage` 或同步至 `Firestore`。

## 🛠️ 開發環境備註 (Development Environment)
- **Node.js/npm Path**: `C:\Users\lien.huang\AppData\node` (未加入 PATH，需手動指定)。
- **CLI Tools**: `@aisuite/chub` 已安裝，可用於 Context Handover。
- **Launcher Routine**: 每屆啟動前必須執行:
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
  `cd C:\Users\lien.huang\AppData\openclaw`
  `.\launch-control.ps1`
- **FB API Version**: v25.0。
- **Render Backend**: `https://light-local-mvp.onrender.com/` (由 `main.py` 驅動)。

## 🛡️ 穩定性與服務規範 (Stability & Security)
1. **CP950 Emoji 禁令**: Python `print()` 絕對禁止使用 Emoji，避免 Windows 本端 `cp950` 編碼崩潰。
2. **IPv6 localhost 修正**: Next.js 請求或後端呼叫必須使用 `127.0.0.1` 取代 `localhost`，避免連線掛掉。
3. **CORS 安全規格**: 雲端環境 `allow_origins=["*"]` 需配合 `allow_credentials=False`。
4. **端點一致性**: 獲取資料類端點 (如：`/stats`) 統一使用 **GET**，與前端 Fetch 對齊。
8. **7-11 辨識與驗證 (Autonomous Recognition)**: 採用「OCR 轉錄 + Python Regex 萃取」的雙階模式。
   - **Step 1 (Vision)**: Gemini 僅負責純文字轉錄 (OCR)，不進行解釋，避免「旗山/嵐山」類幻覺。
   - **Step 2 (Regex)**: Python 負責從轉錄文字中尋找「精確 6 位數」店號及「店名交叉比對」，此為確定性邏輯。
   - **Step 3 (Filter)**: 自動剔除 7-ELEVEN 品牌名與非 6 位數純數字，所有店號必須通過本地 7278 筆 `stores_cloud.json` 驗證。

---
**Last Updated**: 2026-04-04 | **Status**: 7-11 Recognition Synergy v2 Complete
