# LifeOS 開發任務清單 (Task List)

## 📌 當前目標 (v3.7.6)
**建立 RAG Reranker 與多模態技能引擎，將 LifeOS 升級為具備「外部搜尋能力」與「自我開發手冊」的進階系統。**

---

## Phase P1: 基礎設施對齊
- [x] 修正 `memories.py` 中的 `APIResponse` 提取錯誤
- [x] 更新 `system_cortex.md` 中的 Role 分工
- [x] 確保 `registry.json` 反映最新的 `memories` schema

## Phase P2: 語義檢索強化
- [x] 啟用 `cortex_growth_logs` 的語義搜尋支持
- [x] 優化 `chat.py` 的 Lessons 注入邏輯
- [x] 修復 `brain.py` 在向量搜尋失效時的關鍵字 Fallback

## Phase P3: 戰略脈絡整合 (Strategic Intelligence)
- [x] 實作 `MonthlyReview` 注入邏輯
- [x] 具備高層級戰略視野 (Monthly Context)
- [x] 驗證對話中對長期目標的對齊能力

## Phase P4: HOME 儀表板快照修復
- [x] 修復首頁數據抓取 Bug
- [x] 驗證 `TodaySnapshot` 的數據正確性

## Phase P5: RAG Reranker 實驗 (Sandbox)
- [x] 建立 `tools/rag_experiment.py`
- [x] 整合 Hugging Face `CrossEncoder`
- [x] 驗證 Traditional Chinese 的重排序精準度
- [x] 確認 BAI/bge-reranker-v2-m3 效能

## Phase P6: Agent Skills Infrastructure (Completed)
- [x] 建立 `backend-cortex/skills/` 目錄架構
- [x] 實作 `SkillOrchestrator` 基礎邏輯
- [x] 遷移「系統反思」邏輯至 `reflection/SKILL.md`
- [x] 建立「開發交接」技能 `handoff/SKILL.md` (v3.7.5)
- [x] 驗證動態 Prompt 注入效果

## Phase P7: Sync Brain Maintenance (Completed)
- [x] 審計 `sync_brain/` 目錄內容
- [x] 更新 `SYSTEM_CONTEXT.md` 至 v3.7.5 (Agent Skills & Reranker)
- [x] 對齊 `system_cortex.md` 啟動協議

## Phase P8: Web Search Capability (Completed)
- [x] 選擇並配置搜尋 API (duckduckgo-search)
- [x] 實作 `app/services/search.py` (v3.7.6)
- [x] 在 `chat.py` 註冊 `search_web` Tool
- [x] 建立 `skills/research/SKILL.md` 研究協議
- [x] 驗證「內外聯動」的搜尋效果

## Phase P9: Role Alignment & Prompt Optimization (Completed)
- [x] 更新 `sync_brain/system_cortex.md` 以適配搜尋技能
- [x] 強化「開發者 AI」與「使用者系統」的角色邊界
- [x] 執行最終驗證

## Phase P10: Knowledge & Memory Isolation (Completed)
- [x] 獲取並驗證 `documents` 表之 SQL Schema
- [x] 更新 `registry.json` 定義 (包含 Unified Awareness 協議)
- [x] 修改 `rag_service.py` 實作資料流隔離與雙軌檢索
- [x] 實作指令識別 (Intent Routing) 邏輯 (source-based)
- [x] 升級 Crystallize 2.0 (自動文獻摘要)
- [x] 點對點串接 Frontend / Ingest / Chat 流程

## Phase P11-P15: Sandbox & Skill System (Completed)
- [x] 建立 `skills/sandbox` 執行隔離環境
- [x] 遷移核心邏輯至模組化 Skill 協議
- [x] 強化 `System Prompt v3.8` 執行主權

## Phase P16: Cloud Review Logic Fix (Completed)
- [x] 修復 Monthly Review 在雲端環境的 CORS 與 Auth 問題
- [x] 標準化 `fetchProxy` 代理機制

## Phase P17: 視覺/文件多模態 Ingest & Task 過濾邏輯 (2026-02-27)
- [x] 整合 Gemini 2.0 Flash Vision 至 `rag_service` 與 `ingest`
- [x] 支援 CaptureView 拖放圖片、PDF、Markdown 檔案自動解讀
- [x] 修正 `tasks.py` 預設過濾 `status='todo'`，解決 UI 堆積

## Phase P19: Two-Stage RAG 整合 (HuggingFace + Recency Boost) (Completed)
- [x] 建立 `app/services/reranker.py` 單例服務
- [x] 實作 Hybrid Weighting 演算法 (語意相關 + 時間權重)
- [x] 優化 `brain.py` 節點上下文檢索 (Neural Cards)

## Phase P20: Autonomous Model Discovery & Brain Protocol (v4.0) (Completed)
- [x] **Autonomous Model Discovery (v3.9)**: Implement fallback & sandbox testing
- [x] **Agentic DNA Injection**: Standardize `sync_brain` with Skills & History
- [x] **System Health Check**: Final full-stack verification of the new protocol

## Phase P21: Cloud Connectivity & Architectural Fix (v3.8.7)
- [x] Implement dynamic CORS in `backend-cortex/main.py`
- [x] Fix global mutation bug in `backend-cortex/app/core/database.py`
- [x] Enhance frontend proxy logging and URL handling
- [x] Commit and push changes to GitHub (fafbb3d)

## Phase P22: Diary Ingest & Monthly Review Stabilization (v3.8.8)
- [x] Fix Diary Ingest Markdown/JSON parsing logic in `ingest.py`
- [x] Fix Monthly Review `safe_write` import & call in `memories.py`
- [x] Verify fix logic (improved regex for multi-part LLM output)
- [ ] Run Smoke Test (Pending tool creation/location)

---

## 📈 成長記錄
- **2026-03-06 (Bug Fix)**: 解決了 `gemini-2.0-flash-lite` 導致的日記解析失效問題，並修補了 `MonthlyReview` 因為舊函數命名導致的崩潰。
- **2026-03-05 (Cloud Fix)**: 解決了雲端 inaccessible 的三大地雷：CORS 限制、Proxy 網址寫死、以及資料庫連線的全域狀態污染問題。
- **2026-03-05 (Session End)**: 修除了 Windows 下 Next.js `localhost` proxy 解析為 IPv6 導致 uvicorn (IPv4) 請求靜默卡死的問題。
- **2026-03-05**: 完成 Guest Mode (Building in Public)，包含後端權限隔離、前端介面限制與免 Key 登入體驗。
- **2026-02-28**: 升級至 v4.0。導入「自主模型發現」技能與「Agentic DNA」開發協議。
- **2026-02-27**: 完成 Phase P17 & P18。維度對齊 3072。
- **2026-02-26**: 建立 Handoff Skill，解決開發 AI 跨 session 的進度丟失問題。
