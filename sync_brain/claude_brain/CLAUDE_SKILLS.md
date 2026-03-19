# Claude — 跨專案技能庫 (Skills Registry v2.0)

> 這份文件記錄 Claude 在所有專案中累積的可遷移技能與最佳實踐。
> **v2.0 (2026-03-05)**：整合 Antigravity Brain 所有歷史對話的學習內容。

---

## 🏗️ 架構設計技能

### Multi-AI 協作架構設計
**狀態**: ACTIVE（首次建立於 LifeOS 2026-03-05）
**描述**: 設計清晰的 AI 角色分工協議，讓多個 AI 在同一專案中協作不混亂。
**核心原則**:
- 角色聲明先於任何動作（Role-First Protocol）
- 文件擁有權明確（誰寫哪個文件）
- `QUESTIONS.md` 作為跨 AI 異步通訊頻道

### 跨 Session 記憶架構
**狀態**: ACTIVE（來自 LifeOS sync_brain 系統）
**描述**: 設計讓 AI 在 Session 中斷後仍能無縫恢復的記憶系統。
**核心組件**: Identity File + Protocol File + Projects Log + Handoff File
**教訓**: 記憶系統必須「主動觸發」（Session Start Protocol），被動文件不會被讀取。

### 三層 OS 架構設計（Reality → Trend → Intent）
**狀態**: ACTIVE（來自 LifeOS v3.5）
**描述**: 個人系統三層：Diary（現實）→ HOME（趨勢）→ Projects（意圖）
**關鍵整合點**: Diary 寫入時，AI 自動比對 Tasks 並標記完成，同時 bump Project 活躍度。

### Guest Mode / 公開模式架構
**狀態**: ACTIVE（來自 LifeOS Phase F）
**描述**: 無 API Key 訪客唯讀瀏覽公開資料的隔離架構。
**後端**: `database.py` 偵測無 Key → `_is_guest_mode = True` → POST/PATCH/DELETE 全回傳 403，GET 加 `.eq('is_private', False)`
**前端**: localStorage 標記 → `client.ts` 不發送 Key → Dock/CTA/編輯按鈕全隱藏

---

## 💾 資料庫與後端技能

### Schema Drift 防護（safe_write）
**狀態**: ACTIVE（來自 LifeOS 2026-03-05）
`safe_write()` wrapper 攔截 `PGRST204` → 剔除無效欄位 → 自動重試。適用所有 Supabase 專案。

### Supabase APIResponse 正確提取
**狀態**: ACTIVE（Bug fix 來自 dea834b9 對話）
**正確**: `db.table("x").select("*").execute().data` — 必須取 `.data` 屬性才是 list。
**錯誤**: 直接對 `APIResponse` 物件做 index 或 iteration。

### AI Model Discovery 架構
**狀態**: ACTIVE（來自 LifeOS v3.9）
Background thread 探索 → Smoke Test → 審核 → 晉升 active_model。

### 多層 Quota Fallback 鏈
**狀態**: ACTIVE（來自 LifeOS SKILLS.md v4.2）
`Smart Pro` → `Fast Flash` → `Emergency Flash-Lite`，搭配指數退避 + jitter。

---

## 🔍 RAG / AI 搜尋技能

### Two-Stage RAG + Recency Boost
**狀態**: ACTIVE（Phase P19）
語意相似度 + 時間加權，確保「今日最新內容」不被舊記憶壓沉。

### 記憶 vs 文件隔離架構
**狀態**: ACTIVE（Phase P10）
個人日記（`memories`）vs 外部知識（`documents`）物理隔離，防止 RAG 情緒污染。

### Neural Graph 語義節點搜尋
**狀態**: ACTIVE（來自 6086332f 對話）
點擊節點 → `GET /brain/node/{label}/context` → `match_memories` RPC 向量搜尋。
**教訓**: 用「最近50筆」代替向量搜尋 → 舊節點出現空白結果。

### Growth Logs 語義注入
**狀態**: ACTIVE（Phase P2-P3）
Chat 時以語意搜尋找最相關過去 AI 決策教訓，注入 system prompt，讓 AI 記住自己的錯誤。
**關鍵**: `subconscious.py` 必須雙寫：`memories` + `cortex_growth_logs` 兩個表。

### Diary × Task 自動連動
**狀態**: ACTIVE（Phase P4-1）
日記寫入後，`ingest.py` → `auto_link_tasks_projects()` 背景任務 → 自動標記完成 Tasks + bump Project。
UI Toast 通知使用者結果。

---

## 🖥️ 前端 / Windows 技能

### Windows IPv6 代理坑
Next.js `rewrites` 將 `localhost` 解析為 IPv6 → uvicorn (IPv4) 靜默卡死。
**解法**: 前端直接用 `127.0.0.1:PORT`。

### CJK 日期解析陷阱
Python regex `\b` 對中日韓文字無效。
**解法**: 改用 `(?<!\w)` / `(?!\w)`，或不依賴 word boundary 的模式。

### 429 配額降級時的 UI Fallback
**狀態**: ACTIVE（來自 86c5be0d 對話）
AI 因配額失敗 → 不顯示錯誤 → 從 DB 取「深度洞察」作為備用提示。`crystallize.py` Smart Fallback。

### CORS 配置（雲端部署）
**狀態**: ACTIVE（來自 2026-03-05 Cloud Fix）
FastAPI 必須動態設定 CORS（非寫死白名單），`allow_headers` 需明確列出自訂 header：
`X-Supabase-URL`, `X-Supabase-Key`, `X-Gemini-Key`。

---

## 📝 Claude 的學習記錄

| 日期 | 來源 | 教訓 |
|---|---|---|
| 2026-03-05 | LifeOS | Supabase APIResponse 需取 `.data`，不能直接 index |
| 2026-03-05 | LifeOS | Windows IPv6：Next.js proxy 用 `127.0.0.1` |
| 2026-03-05 | LifeOS | CJK regex：`\b` 對漢字無效，改用 lookaround |
| 2026-03-05 | LifeOS | 429 需要 UI Fallback，不能讓使用者看到空白 |
| 2026-03-05 | LifeOS | Growth Logs 必須雙寫才能被 Lessons 注入 |
| 2026-03-05 | LifeOS | 多 AI 分工必須用文件角色聲明鎖定 |
| 2026-03-05 | LifeOS | `sync_brain` 精髓是「主動讀取」而非被動等待 |
| 2026-03-05 | LifeOS | Neural Graph 節點必須用向量搜尋，不能用「最近N筆」 |

---

**最後更新**: 2026-03-05 | **版本**: v2.0（整合 Antigravity Brain 全歷史）
