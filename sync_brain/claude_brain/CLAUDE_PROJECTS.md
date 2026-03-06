# Claude — 跨專案歷史紀錄 (Projects Log v2.0)
> v2.0 (2026-03-05)：整合 Antigravity Brain 所有對話後重建的完整歷史。

> 這是 Claude 的個人專案履歷。每個專案完成後必須在此追加記錄。
> 此文件讓 Claude 在加入新專案時，能立刻調取過去的決策脈絡與教訓。

---

## 📋 專案清單

| # | 專案名稱 | 狀態 | 期間 | 核心技術 |
|---|---|---|---|---|
| 001 | LifeOS | 🟢 進行中 | 2026-02 ~ | FastAPI, Next.js 15, Supabase, Gemini |

---

## 🗂️ 專案詳細紀錄

### [001] LifeOS — 個人生命操作系統

**指揮官**: 蒼禾 (Lien Huang)
**狀態**: 進行中（v4.0）
**期間**: 2026-02 起
**目錄**: `C:\Users\lien.huang\AppData\lifeosjxs\`

#### 系統定位
自動感知日記、管理知識圖譜、驅動個人專案的 AI 驅動個人 OS。

#### 架構摘要
```
前端 (The Body)    : Next.js 15 + Tailwind, Vercel 部署
後端 (The Cortex)  : FastAPI (Python 3.13+), Render 部署
記憶層 (Hippocampus): Supabase Postgres + pgvector (3072 維)
開發大腦 (Brain)   : sync_brain/ 目錄（跨 Session 記憶中樞）
```

#### 重大架構決策
| 決策 | 日期 | 原因 |
|---|---|---|
| 使用 `safe_write()` 取代 raw Supabase insert | 2026-03-05 | Schema Drift 導致背景任務靜默失敗 |
| 前端棄用 Next.js proxy rewrites | 2026-03-05 | Windows IPv6 解析導致靜默卡死 |
| 動態 CORS（非寫死白名單） | 2026-03-05 | 雲端部署 URL 不固定 |
| AI 三層分工協議 + claude_brain/ | 2026-03-05 | 多 AI 協作缺乏角色邊界 |
| ModelDiscoveryService 自主模型發現 | 2026-02-28 | 硬編碼模型 ID 導致上線後 404 |
| 記憶 vs 文件 資料隔離（P10） | 2026-02 | RAG 情緒污染問題 |
| Neural Graph 改用向量搜尋（而非最近N筆） | 2026-02 | 舊節點點擊出現空白 |
| Diary × Task 自動連動（P4-1） | 2026-02 | 手動操作太繁瑣，日記和任務脫節 |
| Guest Mode 唯讀隔離（Phase F） | 2026-02 | 公開分享 URL 不能暴露私人資料 |
| subconscious 雙寫 memories + growth_logs | 2026-02 | 反思結果不寫 DB 則 Lessons 注入失效 |

#### 踩坑紀錄（下個專案必讀）
1. **Windows cp950 Emoji 崩潰**：Python `print()` 有 Emoji → Windows shell 崩。一律用 `[OK]`/`[WARN]`/`[ERROR]`。
2. **Supabase Schema Drift 靜默失敗**：雲端 Schema 缺欄位 → 背景任務無聲失敗。必須用 `safe_write()` 全局 wrapper。
3. **Supabase APIResponse 需取 `.data`**：`execute()` 回傳物件，不是 list。`execute().data` 才是。
4. **AI 模型 ID 不穩定**：Gemini 模型版本常變，必須用 `ModelDiscoveryService` 動態發現。
5. **RAG 時間盲點**：純語意搜尋找不到「今天剛寫的日記」，Recency Boost 是必要的。
6. **Neural Graph 空白卡片**：用「最近50筆」做節點上下文 → 舊節點沒結果。必須用向量搜尋。
7. **CJK 正規表達式**：Python `\b` 對漢字無效，日期提取解析會失敗。改用 lookaround。
8. **429 配額 UI 空白**：AI 失敗時若不做 Fallback → 使用者看到空白。要從 DB 取備用內容。
9. **CORS 自訂 Header**：FastAPI `allow_headers` 若未明列 `X-Supabase-URL` 等 → 預檢請求 403。
10. **subconscious 單寫問題**：只寫 `memories` → Lessons 注入機制找不到反思。必須同時寫 `cortex_growth_logs`。

#### 重要 API Endpoints（供下次快速定位）
| 端點 | 功能 |
|---|---|
| `POST /api/v1/ingest` | 日記寫入 + 自動連動 Tasks |
| `GET /api/v1/brain/graph` | Neural Graph 資料 |
| `GET /api/v1/brain/node/{label}/context` | 節點語義搜尋 |
| `GET /api/v1/brain/growth/lessons` | AI 成長教訓注入 |
| `GET /api/v1/memories/recent` | 首頁 TodaySnapshot |
| `POST /api/v1/chat` | RAG 對話 |

#### Claude 在此專案的主要貢獻
- 設計 Multi-AI 協作架構（Claude=架構師 / Gemini Pro=任務管家 / Gemini Flash=工程師）
- 建立 `claude_brain/` 可攜式 AI 大腦系統（本文件所在）
- 整合 Antigravity Brain 全歷史，建立 CLAUDE_SKILLS v2.0

---


## 📝 新專案接入模板

當加入新專案時，複製以下模板追加至此文件：

```markdown
### [00X] [專案名稱]

**指揮官**: 蒼禾 (Lien Huang)
**狀態**: [規劃中/進行中/完成]
**期間**: [開始日期] ~
**目錄**: [專案路徑]

#### 系統定位
[一句話描述這個專案是什麼]

#### 架構摘要
[技術棧與部署]

#### 重大架構決策
| 決策 | 日期 | 原因 |

#### 踩坑紀錄
1. 

#### Claude 在此專案的主要貢獻
- 
```

---

**最後更新**: 2026-03-05 | **版本**: v1.0
