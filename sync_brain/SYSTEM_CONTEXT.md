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
- **M6 銷售記帳 (Sales)**: 記錄銷售單，扣除庫存，計算單筆毛利。
- **M7 設定與備份 (Settings)**: 匯出 JSON / 一鍵清空資料。

## 🚦 開發原則與限制
- **純本地儲存**: 絕對禁止引入 Supabase, Prisma 或其他伺服器資料庫。所有業務資料限於 `LocalStorage`。
- **圖片「閱後即焚」**: 圖片送到 `/api/ocr` 辨識完畢後，即刻丟棄，不可存入 LocalStorage 或檔案系統，避免爆容量。
- **狀態管理集中化**: 所有的商品、批次、攤提狀態必須放在 Zustand Store，並使用 JSON 序列化持久存儲。

## 🛠️ 開發環境備註 (Development Environment)
- **Node.js/npm Path**: `C:\Users\lien.huang\AppData\node` (未加入 PATH，需手動指定)。
- **CLI Tools**: `@aisuite/chub` 已安裝，可用於 Context Handover。
- **FB API Version**: v25.0。
- **Render Backend**: `https://light-local-mvp.onrender.com/` (由 `main.py` 驅動)。

## 🛑 核心開發禁令 (Critical Stability Rules)
1. **禁止 Emojis**: 後端 Python `print()` 絕對禁止使用 Emoji，避免 Windows `cp950` 編碼崩潰。
2. **禁止 localhost**: 在 Next.js 請求或後端呼叫中，必須使用 `127.0.0.1` 取代 `localhost`，避免 Windows IPv6 造成的連線延遲/斷開。
3. **路徑修正**: 雲端部署 (Render) 若發生 `ModuleNotFoundError`，必須在 `main.py` 第 1 行注入 `sys.path` 修正。

---
**Last Updated**: 2026-03-18 | **Status**: Phase 3 AI Optimized (Gemma/Gemini Tiered Routing Deployed)
