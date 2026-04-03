# 👗 MuMu Apparel - Local-First Order MVP

這是一個專為服飾直播業者設計的 **極簡、極速、雲端同步** 的理貨與記帳系統。採用「本地優先 (Local-First)」結合 `Firebase Firestore` 雲端架構，在享受極速響應的同時實現跨設備資料同步，並有效極小化資料庫維護成本。

## 🌟 核心理念 (Philosophy)

- **雲端資料同步 (Cloud Sync)**: 整合 `Firebase Firestore` 進行買賣雙方的資料對接與分享。
- **本地優先核心 (Local-First)**: 前端主要使用 `Zustand` + `LocalStorage` 持久化，確保極速的操作體驗。
- **極致隱私**: 圖片「閱後即焚」，不儲存任何照片實體。

## 🏗️ 專案結構 (Structure)

```text
root/
├── app/                 # Next.js 前端 (理貨看板、買家結帳頁)
├── backend/             # Python FastAPI 後端 (AI 辨識、FB Webhook)
├── sync_brain/          # [重要] 專案憲法與 AI 長期記憶庫
├── components/          # UI 元件庫 (Shadcn UI)
├── scripts/             # 門市資料庫與自動化腳本
└── public/              # 靜態資源
```

## 🛠️ 快速啟動 (Get Started)

### 前端 (Frontend)
```powershell
npm install
npm run dev
```

### 後端 (Backend)
請參閱 [backend/README.md](./backend/README.md) 進行設定。

## 🧠 AI 協作協議 (Sync Brain)

本專案使用 `sync_brain/` 目錄作為人機協作的「共同真理」。
- **SYSTEM_CONTEXT.md**: 開發規範與穩定性禁令。
- **HUMAN_AI_AGREEMENT.md**: 雙方約定的實作協議。
- **ROADMAP.md**: 目前開發進度與未來里程碑。

## 🚀 最新功能：7-11 辨識協同 (Synergy)
系統現已支援智慧型門市解析。透過結合 AI 的模糊提取與 Python 的實體資料庫比對，能精準排除發票號碼等噪訊數字，並在身分不符時提供預警。

---
**專案狀態**: 已上線 (v7.1 Stable) | **維護者**: 指揮官 & Antigravity
