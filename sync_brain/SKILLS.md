# 取貨記帳系統 Skills (v1.0)

這份文件紀錄了系統內建的特殊演算法與核心邏輯，開發時請直接套用或擴充。

---

## 🛠️ 批次匯率絕對鎖定 (Batch-Rate Lock)
**Category**: Core Business Logic
**Status**: ACTIVE 

### Description
所有的進貨單據 (Items) 不直接存放獨立的匯率，而是必須綁定到一個 **批次 (Batch)**。批次持有一個鎖定的匯率，確保當次進貨的所有外幣都能精準轉換為初始台幣成本。

### Technical Logic
```typescript
interface Batch {
  id: string;
  name: string; // e.g., "2026-03 越南批貨"
  exchangeRate: number; // e.g., 781 (代表 100 萬越幣 = 781 台幣)
}

interface Item {
  id: string;
  batchId: string;
  foreignCost: number; // 外幣價格 (通常省略千位，如 85 代表 85,000 VND)
  // 本地初始成本 = foreignCost * (1000 / batches.find(b => b.id === batchId)?.exchangeRate)
  // 例如單價寫 85，匯率 781，成本 = 85 * (1000 / 781) ≈ 108.83 台幣
}
```

---

## ⚖️ 重量比例攤提演算法 (Weight-Based Amortization)
**Category**: Core Business Logic
**Status**: PENDING IMPLEMENTATION

### Description
針對服飾業的物流攤提痛點：大衣極重、飾品極輕，若按件數均攤運費將導致成本失真。

### Technical Logic
1. 使用者輸入該批次的總國際運費 (Total Shipping Cost)。
2. 使用者為該批次內的每項商品輸入一個「重量權重估值」 (例如：T恤=1, 牛仔褲=3, 大衣=5, 飾品=0.2)。
3. 計算該批次總權重 = $\sum (\text{單項商品權重} \times \text{數量})$。
4. 計算單項商品的分攤運費 = $(\frac{\text{單項商品權重}}{\text{總權重}}) \times \text{總運費}$。
5. 最終 Landed Cost = 初始台幣成本 + 分攤運費。

---

## 🔥 圖片閱後即焚防線 (Ephemeral Imaging)
**Category**: Storage Protection
**Status**: ACTIVE

### Description
強制規定送往 Gemini Vision 的照片，在其 `Promise` resolved 之後，相關的 `base64` 字串或 `File` 物件必須被垃圾回收 (Garbage Collected)，絕對不能進入 Zustand Store 引發 LocalStorage `QuotaExceededError`。
