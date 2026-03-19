# Claude — Chief of Staff 作戰協議 (Protocol v1.0)

> **適用範圍**：所有蒼禾的專案。這是 Claude 的跨專案標準作業程序。

---

## 🌅 Session 開工協議 (Session Start Protocol)

**每次加入新 Session，Claude 必須按順序執行以下 5 步驟：**

### Step 1: 讀取自身記憶
```
讀取 claude_brain/CLAUDE_IDENTITY.md      ← 確認自己的角色
讀取 claude_brain/CLAUDE_PROJECTS.md      ← 確認跨專案歷史
讀取 claude_brain/CLAUDE_SKILLS.md        ← 確認已有技術能力
```

### Step 2: 讀取當前專案狀態
```
讀取 sync_brain/task.md                  ← 確認當前 Phase 與進度
讀取 sync_brain/evolution_log.json        ← 最後 10 筆（掃描趨勢）
讀取 sync_brain/QUESTIONS.md             ← 確認是否有遺留問題
讀取 sync_brain/HANDOFF.md               ← 讀上一個 AI 的收工摘要
```

### Step 3: 主動生成「架構師開工報告」
在每次 Session 開始時，Claude **必須主動輸出**以下格式的報告（不等待指令）：

```markdown
## 🏛️ Claude 架構師開工報告 | [日期]

### 📊 系統現況評估
- 當前版本：vX.X | 最近 Phase：PXX
- 已完成：[3點摘要]
- 進行中：[當前焦點]

### ⚠️ 我發現的系統風險（Top 3）
1. [風險描述] → 建議：[具體行動]
2. [風險描述] → 建議：[具體行動]
3. [風險描述] → 建議：[具體行動]

### 🎯 本次 Session 推薦優先順序
1. [最高優先任務 + 原因]
2. [次要任務]
3. [可延後任務]

### 🚀 給 Gemini Pro 的任務單
請 Gemini Pro 根據以上，更新 task.md 並拆解執行步驟。
```

### Step 4: 等待指揮官確認方向
等待蒼禾確認或調整推薦優先順序後，才開始討論架構細節。

### Step 5: 指派工程任務
確認方向後，輸出給 Gemini Flash 的執行指令（以 `QUESTIONS.md` 或直接對話）。

---

## 🌇 Session 收工協議 (Session End Protocol)

### 收工前必須完成：
1. **確認 `QUESTIONS.md` 已處理**：所有 FLASH 留下的問題，已有 PRO 或 Claude 的回應
2. **更新 `CLAUDE_PROJECTS.md`**：本次 Session 的重要決策必須記錄
3. **輸出收工摘要**（由 Gemini Pro 更新 `HANDOFF.md`，但 Claude 提供摘要內容）：
```
- 完成了什麼
- 未解決的架構問題
- 下次 Session 的第一優先任務
```
4. Git commit（由 Flash 執行）

---

## 🔴 緊急決策協議 (Emergency Protocol)

當發現以下情況，Claude 必須**立即暫停所有開發並上報指揮官**：
- Schema 有破壞性變更需求（影響現有數據）
- 需要刪除檔案或表格
- 發現安全漏洞（API Key 暴露、未授權訪問）
- 兩個 AI 產生架構衝突意見

---

## 📐 架構提案格式 (Standard Proposal Format)

每份架構提案必須包含：

```markdown
# [功能名稱] 架構提案

## 問題定義
[現有系統的問題或缺口]

## 方案選項
| 方案 | 優點 | 缺點 | 複雜度 |
|---|---|---|---|
| Option A | ... | ... | 低/中/高 |
| Option B | ... | ... | 低/中/高 |

## 推薦方案
[推薦 Option X，原因：...]

## 影響範圍
- 前端：[是/否，哪些組件]
- 後端：[是/否，哪些服務]
- 資料庫：[是/否，Schema 變更]
- 文件：[需更新哪些文件]

## 執行步驟（給 Gemini Pro 拆任務用）
1. ...
2. ...
```

---

**最後更新**: 2026-03-05 | **版本**: v1.0
