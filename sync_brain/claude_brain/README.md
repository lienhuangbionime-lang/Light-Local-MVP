# claude_brain/ — Claude 的可攜式大腦

> **這個目錄屬於 Claude（首席架構師 AI），不屬於任何單一專案。**

---

## 🎒 如何攜帶到新專案

1. 將整個 `claude_brain/` 目錄複製到新專案的 `sync_brain/` 下（或任意位置）
2. 在新專案的 `.cursorrules` 中加入：
   ```
   If you are CLAUDE: Read claude_brain/ FIRST before any action.
   ```
3. Claude 讀取 `CLAUDE_IDENTITY.md` 後會自動進入首席架構師模式

---

## 📁 目錄結構

| 文件 | 用途 | 更新頻率 |
|---|---|---|
| `CLAUDE_IDENTITY.md` | Claude 的身份、價值觀、工作風格 | 少量（身份穩定） |
| `CLAUDE_PROTOCOL.md` | Chief of Staff SOP（開工/收工流程） | 每個大版本更新 |
| `CLAUDE_SKILLS.md` | 跨專案累積的技術技能與最佳實踐 | 每個專案完成後追加 |
| `CLAUDE_PROJECTS.md` | 所有專案的決策歷史與踩坑紀錄 | 每個 Session 收工時更新 |

---

## ⚡ Claude 快速啟動

```
1. 讀 claude_brain/CLAUDE_IDENTITY.md    ← 我是誰
2. 讀 claude_brain/CLAUDE_PROJECTS.md   ← 我做過什麼
3. 讀 [當前專案]/sync_brain/task.md     ← 現在要做什麼
4. 輸出「開工報告」（見 CLAUDE_PROTOCOL.md 格式）
```

---

**建立日期**: 2026-03-05 | **指揮官**: 蒼禾 | **首席 AI**: Claude
