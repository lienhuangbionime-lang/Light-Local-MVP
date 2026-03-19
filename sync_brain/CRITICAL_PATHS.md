# 取貨記帳系統 — 關鍵路徑保護清單 (CRITICAL_PATHS.md)

> **任何 AI 在修改下列模組前，必須先閱讀此文件，確保不破壞本地資料庫流程。**

---

## 🔴 高風險文件（修改前必須高度謹慎）

| 文件/模組 | 影響功能 | 主要風險 |
|---|---|---|
| **Zustand Store (`lib/store.ts`)** | 全應用程式資料儲存 | 任意變更介面 (Interface) 可能導致舊有 LocalStorage 解析錯誤或崩潰（白屏）。修改資料結構時需考慮向前相容性。 |
| **API Route (`/api/ocr/route.ts`)** | 單據辨識 | 這是唯一的伺服端點。若因逾時、解析錯誤或意外導致照片實體留存，將違反「閱後即焚」原則，或導致辨識流程中斷。 |
| **M3 模組 (`digitize.tsx`)** | 成本源頭 | 「外幣單價 × M2 批次匯率」的數學計算不可有誤差。若算錯，後續庫存利潤將全盤皆錯。 |
| **M4 模組 (`shipments.tsx`)** | 最終成本攤提 | 若「按重量比例攤提」的演算法寫錯，會影響最終 Landed Cost，導致服飾業定價策略失準。 |
| **運費配置 (`config.py` / `settings.tsx`)** | Excel 導出對帳 | `BUYER_SHIPPING_FEE` 與 `PLATFORM_SHIPPING_FEE` 直接參與 Excel F/G 欄位的金額加減運算。若值不正確，會導致 7-11 匯入金額與實收金額不符。 |

---

## ✅ 修改 Store 結構的標準步驟

因系統依賴 LocalStorage，每次改 Store 結構都可能導致資料死鎖：

1. **設計欄位增加/移除**：在 `task.md` 紀錄結構變更。
2. **設定預設值**：新欄位必須有安全的預設值，避免現有使用者的 LocalStorage 讀出 `undefined` 造成 React Render Crash。
3. **防禦性程式碼**：在存取 Zustand state 時，多使用 Optional Chaining (`state.item?.cost`)。

---

## ⚠️ 已知的陷阱（修改時注意）

1. **圖片爆表**：絕對不要把前端的 `<input type="file">` Base64 結果寫進 Zustand Store。LocalStorage 容量只有 5MB，若存入照片會在一兩張單據後立刻崩潰：`QuotaExceededError`。
2. **匯率精度**：匯率通常是很小的小數點（例如越盾 `0.00128`），在 TypeScript 進行乘法計算時，需注意浮點數精度問題並妥善 `Math.round()` 或保持特定小數位數。

---

**最後更新**: 2026-03-06
