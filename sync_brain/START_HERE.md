# 開發 AI 交接文檔 — 取貨記帳系統 (Local-First MVP)

> **你是誰**：你是**開發 AI**（Antigravity 或其繼承者），負責開發與擴展這套純本地端的服飾業進銷存系統。

---

## 🏗️ 1. 核心模組對照表 (The Anatomy Matrix)

當你收到指令時，請優先參考此表定位代碼與數據位位 (皆儲存於 Zustand / LocalStorage)：

| 模組代號 | 名稱 | 前端組件 / 路徑 | 功能敘述 | 儲存目標 (Zustand) |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | **總覽看板 Dashboard** | `app/page.tsx` 或 `DashboardPage` | 檢視庫存總值、利潤、銷售概覽 | `(讀取全局聚合資料)` |
| **M2** | **進貨批次與匯率 Batch** | 待建立 | 建立進貨批次並鎖定當次換匯匯率 | `batches` |
| **M3** | **單據辨識 Digitize** | `components/pages/digitize.tsx` | 拍照上傳單據 -> AI 辨識 -> 閱後即焚 -> 套用批次匯率算出台幣初估成本 | `items` / `scans` |
| **M4** | **物流攤提 Shipments** | 待建立 | 運費攤提 (支援按重量比例)，算出最終單位成本 | `shipments` |
| **M5** | **庫存管理 Inventory** | `components/pages/inventory.tsx` | 查詢、編輯商品庫存量與最終成本 | `items` |
| **M6** | **銷售記帳 Sales** | `components/pages/sales.tsx` | 記錄銷售單，扣除庫存，計算單筆毛利 | `sales` |
| **M7** | **設定與備份 Backup** | `components/pages/settings.tsx` | 匯出備份 JSON，一鍵清空所有 LocalStorage 資料 | `(操作全局 Store)` |

---

## 🔄 2. 開發工作流程 (Session Workflow)

為了確保不同 Session 之間的進度不丟失，執行複雜任務前，請遵循：

1. **對齊文件**: 讀取 `task.md` 與 `implementation_plan.md` 確認當前任務。
2. **計畫先行**: 變更核心 Store 結構前，務必通知並取得指揮官同意。
3. **保持輕量**: 實作新功能時反問自己「這需要後端嗎？」，如果不需要，就寫在 Client Component 裡。

---

## 📋 系統真理地圖 (Truth Map)

| 檔案 | 內容描述 | 重要度 |
|---|---|---|
| [START_HERE.md](file:///c:/Users/lien.huang/AppData/Local-First%20MVP/sync_brain/START_HERE.md) | **你正在讀的這個檔案 (單一入口)** | 🌟🌟🌟 |
| [HUMAN_AI_AGREEMENT.md](file:///c:/Users/lien.huang/AppData/Local-First%20MVP/sync_brain/HUMAN_AI_AGREEMENT.md) | **人機協作協議 (架構圖、無伺服器準則)** | 🌟🌟🌟 |
| [SYSTEM_CONTEXT.md](file:///c:/Users/lien.huang/AppData/Local-First%20MVP/sync_brain/SYSTEM_CONTEXT.md) | 系統真理、服飾業專屬邏輯與限制 | 🌟🌟🌟 |
| [CRITICAL_PATHS.md](file:///c:/Users/lien.huang/AppData/Local-First%20MVP/sync_brain/CRITICAL_PATHS.md) | 容易出錯的關鍵組件保護名單 | 🌟🌟 |
| [ROADMAP.md](file:///c:/Users/lien.huang/AppData/Local-First%20MVP/sync_brain/ROADMAP.md) | 演化願景與功能規劃 | 🌟 |

---

## 🛠️ 核心開發守則

1. **禁止後端資料庫**: 嚴禁引入 Supabase/Prisma/Postgres 等技術。完全依賴 LocalStorage。
2. **保護手機空間**: `M3` 操作時產生之照片 Base64 資料，只允許存放於暫存狀態，送往 `/api/ocr` 分析完成後必須**立刻清空**，絕不可進入 Zustand 的持久化區塊。
3. **組件設計**: 使用 Tailwind CSS 與 Client Components，保持動態流暢的 UI 體驗。
