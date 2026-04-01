import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export const DEFAULT_BACKEND_URL = typeof window !== "undefined" && window.location.hostname === "localhost" 
  ? "http://127.0.0.1:8000" 
  : "https://light-local-mvp.onrender.com";

export type AppTab = "dashboard" | "batch" | "digitize" | "shipments" | "inventory" | "sales" | "live" | "settings";

export interface Batch {
  id: string;
  name: string; // e.g., "2026-03 越南批貨"
  exchangeRate: number; // e.g., 781 (代表 100 萬越幣 = 781 台幣)
  createdAt: string;
  status: "active" | "completed";
}

export interface Item {
  id: string;
  batchId: string;
  name: string;
  foreignCost: number; // 外幣價格 (通常省略千位，如 85 代表 85,000 VND)
  localCostBase: number; // 本地初始成本 = foreignCost * (1000 / exchangeRate)
  localCostLanded: number; // 最終攤提成本 (初始成本 + 運費攤提)
  quantity: number;
  weightRatio: number; // 重量權重，供攤提計算使用
  imageUrl?: string; // 僅供記憶體暫存，不應持久化，若有則為例外
  suggestedPrice?: string; // 建議售價格式 (如 1+1:500)
  description?: string; // 產品詳細特色說明
  material?: string;    // 材質
  sizes?: string;       // 尺寸 (如 S,M,L)
  colors?: string;      // 顏色 (如 紅,藍,黑)
  createdAt: string;
}

export interface Shipment {
  id: string;
  batchId: string;
  totalCostTWD: number; // 該批次的國際總運費
  amortizationMethod: "count" | "weight"; // 件數均攤 or 重量比例攤提
  createdAt: string;
}

export interface Sale {
  id: string;
  itemId: string;
  itemName: string;
  buyerName?: string; // 加入買家姓名
  quantity: number;
  unitPrice: number; // 售出單價
  totalRevenue: number;
  profit: number; // (unitPrice - localCostLanded) * quantity
  batchId?: string; // The batch this sale is attributed to (optional during creation)
  source?: "live" | "manual" | "import"; // 銷售來源
  liveSessionId?: string; // 若為直播來源，可標記場次 ID
  createdAt: string;
}

export interface LiveProductMapping {
  code: string;
  productId: string;
  priceRule: string;
}

interface AppState {
  // Navigation State
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Domain Data State
  batches: Batch[];
  items: Item[];
  shipments: Shipment[];
  sales: Sale[];
  geminiApiKey: string;
  fbPageToken: string;
  backendUrl: string;
  shippingFee: number;
  isLiveActive: boolean;
  currentLiveSessionId: string | null;
  lastHarvestedOrders: any[];
  liveProductMappings: LiveProductMapping[];
  orderMirror: any[];
  processedIdMirror: string[];
  adminSecret: string;
  language: "zh-TW" | "vi";

  // Domain Actions
  addBatch: (batch: Omit<Batch, "id" | "createdAt" | "status"> & { id?: string }) => void;
  updateBatchStatus: (id: string, status: "active" | "completed") => void;

  addItem: (item: Omit<Item, "id" | "createdAt" | "localCostBase" | "localCostLanded" | "suggestedPrice" | "description" | "material" | "sizes" | "colors"> & Partial<Pick<Item, "suggestedPrice" | "description" | "material" | "sizes" | "colors">>) => void;
  updateItemQuantity: (id: string, quantityDelta: number) => void;
  updateItemMetadata: (name: string, metadata: Partial<Pick<Item, "description" | "material" | "sizes" | "colors" | "suggestedPrice">>) => void;
  renameItem: (oldName: string, newName: string) => void;
  removeItem: (id: string) => void;
  addShipment: (shipment: Pick<Shipment, "batchId" | "totalCostTWD" | "amortizationMethod">) => void;
  addSale: (sale: Omit<Sale, "id" | "createdAt" | "profit" | "totalRevenue">) => void;
  removeSale: (id: string) => void;
  setGeminiApiKey: (key: string) => void;
  setFbPageToken: (token: string) => void;
  setBackendUrl: (url: string) => void;
  setShippingFee: (fee: number) => void;
  setIsLiveActive: (active: boolean) => void;
  startNewLiveSession: () => void;
  setLastHarvestedOrders: (orders: any[]) => void;
  setLiveProductMappings: (mappings: LiveProductMapping[]) => void;
  setOrderMirror: (orders: any[]) => void;
  setProcessedIdMirror: (ids: string[]) => void;
  setAdminSecret: (secret: string) => void;
  setLanguage: (lang: "zh-TW" | "vi") => void;

  // Live Logistics Actions
  harvestLiveOrders: (
    confirmedOrders: any[],
    codeToProductIdMap: Record<string, string>,
    codeToPriceRulesMap: Record<string, string>
  ) => void;

  // Global Actions
  clearData: () => void;
  mergeData: (data: Partial<AppState>) => void;
  mergeItemsByName: () => void;
}

// Initial mock data to ensure we have structural backward compatibility during rewrite
const initialBatches: Array<Batch> = [
  {
    id: "batch-001",
    name: "2024年3月 河內批貨",
    exchangeRate: 781, // 1000 TWD = 781k VND
    status: "active",
    createdAt: "2024-03-01T10:00:00Z"
  }
];

const initialItems: Array<Item> = [
  {
    id: "prod-001",
    batchId: "batch-001",
    name: "越南咖啡粉 500g",
    foreignCost: 85, // corresponds to 85,000 VND
    localCostBase: 108.83, // 85 * (1000 / 781)
    localCostLanded: 135,
    quantity: 25,
    weightRatio: 1,
    createdAt: "2024-03-01T10:00:00Z"
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeTab: "dashboard",
      setActiveTab: (tab) => set({ activeTab: tab }),

      batches: initialBatches,
      items: initialItems,
      shipments: [],
      sales: [],
      geminiApiKey: "",
      fbPageToken: "",
      backendUrl: DEFAULT_BACKEND_URL,
      shippingFee: 38,
      isLiveActive: false,
      currentLiveSessionId: null,
      lastHarvestedOrders: [],
      liveProductMappings: [{ code: "A", productId: "", priceRule: "" }],
      orderMirror: [],
      processedIdMirror: [],
      adminSecret: "",
      language: "zh-TW",
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setFbPageToken: (token) => set({ fbPageToken: token }),
      setBackendUrl: (url) => set({ backendUrl: url }),
      setShippingFee: (fee) => set({ shippingFee: fee }),
      setIsLiveActive: (active) => set({ isLiveActive: active }),
      setLastHarvestedOrders: (orders) => set({ lastHarvestedOrders: orders }),
      setLiveProductMappings: (mappings) => set({ liveProductMappings: mappings }),
      setOrderMirror: (orders) => set({ orderMirror: orders }),
      setProcessedIdMirror: (ids) => set({ processedIdMirror: ids }),
      setAdminSecret: (secret) => set({ adminSecret: secret }),
      setLanguage: (lang) => set({ language: lang }),

      addBatch: (batchData) => set((state) => ({
        batches: [...state.batches, {
          ...batchData,
          id: batchData.id || crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          status: "active"
        }]
      })),

      updateBatchStatus: (id, status) => set((state) => ({
        batches: state.batches.map(b => b.id === id ? { ...b, status } : b)
      })),

      addItem: (itemData) => set((state) => {
        const id = crypto.randomUUID();
        const batch = state.batches.find(b => b.id === itemData.batchId);
        const exchangeRate = batch?.exchangeRate || 781; 
        const localCostBase = itemData.foreignCost * (1000 / exchangeRate);

        return {
          items: [...state.items, {
            ...itemData,
            id,
            localCostBase,
            localCostLanded: localCostBase,
            suggestedPrice: itemData.suggestedPrice || "",
            description: itemData.description || "",
            material: itemData.material || "",
            sizes: itemData.sizes || "",
            colors: itemData.colors || "",
            createdAt: new Date().toISOString()
          }],
        };
      }),

      startNewLiveSession: () =>
        set(() => ({
          currentLiveSessionId: `live-${new Date().toISOString()}`,
          isLiveActive: true,
        })),

      updateItemQuantity: (id, quantityDelta) => set((state) => ({
        items: state.items.map(item =>
          item.id === id
            ? { ...item, quantity: item.quantity + quantityDelta } // [SHORTAGE] 移除 Math.max(0, ...)，支援負數庫存
            : item
        )
      })),
      
      updateItemMetadata: (name, metadata) => set((state) => ({
        items: state.items.map((i) =>
          i.name.toLowerCase().trim() === name.toLowerCase().trim() 
            ? { ...i, ...metadata } 
            : i
        ),
      })),

      renameItem: (oldName, newName) => set((state) => {
        const trimmedOld = oldName.toLowerCase().trim();
        const trimmedNew = newName.trim();
        if (!trimmedNew) return state;

        return {
          items: state.items.map(i => 
            i.name.toLowerCase().trim() === trimmedOld ? { ...i, name: trimmedNew } : i
          ),
          sales: state.sales.map(s => 
            s.itemName.toLowerCase().trim() === trimmedOld ? { ...s, itemName: trimmedNew } : s
          )
        };
      }),

      removeItem: (id: string) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      addShipment: (shipmentData) => set((state) => {
        const newShipment: Shipment = {
          ...shipmentData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        };

        const batchItems = state.items.filter(item => item.batchId === shipmentData.batchId);

        if (batchItems.length === 0) {
          return { shipments: [...state.shipments, newShipment] };
        }

        let weightSum = 0;
        let countSum = 0;

        if (shipmentData.amortizationMethod === "weight") {
          weightSum = batchItems.reduce((sum, item) => sum + (item.weightRatio * item.quantity), 0);
        } else {
          countSum = batchItems.reduce((sum, item) => sum + item.quantity, 0);
        }

        const updatedItems = state.items.map(item => {
          if (item.batchId !== shipmentData.batchId) return item;

          let amortizedCost = 0;
          if (shipmentData.amortizationMethod === "weight" && weightSum > 0) {
            const itemWeightShare = (item.weightRatio * item.quantity) / weightSum;
            const totalAmortizedForThisItemType = shipmentData.totalCostTWD * itemWeightShare;
            amortizedCost = totalAmortizedForThisItemType / (item.quantity || 1);
          } else if (shipmentData.amortizationMethod === "count" && countSum > 0) {
            amortizedCost = shipmentData.totalCostTWD / countSum;
          }

          // Important: WAC for Landed Cost
          // (OldQty * OldLanded + NewQtyAddedByThisAmortization * NewLanded) / TotalQty
          // But since addShipment usually happens right after addItem, and we reset landed to base in addItem,
          // we can just add the amortized cost to the current (potentially weighted) base.
          return {
            ...item,
            localCostLanded: item.localCostBase + amortizedCost
          };
        });

        return {
          shipments: [...state.shipments, newShipment],
          items: updatedItems
        };
      }),

      addSale: (saleData) => set((state) => {
        // Find ALL items with this name (case-insensitive)
        const sameNamedItems = state.items
          .filter(i => i.name.toLowerCase().trim() === saleData.itemName.toLowerCase().trim())
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // FIFO: Oldest first

        let remainingToSell = saleData.quantity;
        const newSales: Sale[] = [];
        let updatedItems = [...state.items];

        for (const item of sameNamedItems) {
          if (remainingToSell <= 0) break;
          // [SHORTAGE] 即使庫存為 0，也要繼續扣除，產生負數以追蹤欠貨
          const sellFromThisItem = remainingToSell; 
          const revenueFromThisItem = saleData.unitPrice * sellFromThisItem;
          const profitFromThisItem = (saleData.unitPrice - item.localCostLanded) * sellFromThisItem;

          // Record individual sale record for this batch attribution
          newSales.push({
            id: crypto.randomUUID(),
            itemId: item.id,
            itemName: item.name,
            quantity: sellFromThisItem,
            unitPrice: saleData.unitPrice,
            totalRevenue: revenueFromThisItem,
            profit: profitFromThisItem,
            batchId: item.batchId,
            source: saleData.source ?? "manual",
            liveSessionId: saleData.liveSessionId,
            createdAt: new Date().toISOString()
          });

          // Update item quantity in our local copy
          updatedItems = updatedItems.map(i =>
            i.id === item.id
              ? { ...i, quantity: i.quantity - sellFromThisItem }
              : i
          );

          remainingToSell -= sellFromThisItem;
        }

        if (newSales.length === 0) return state;

        return {
          sales: [...state.sales, ...newSales],
          items: updatedItems
        };
      }),

      removeSale: (id: string) => set((state) => {
        const sale = state.sales.find(s => s.id === id);
        if (!sale) return state;

        // Restore quantity to the specific batch item
        const updatedItems = state.items.map(item => 
          item.id === sale.itemId 
            ? { ...item, quantity: item.quantity + sale.quantity }
            : item
        );

        return {
          sales: state.sales.filter(s => s.id !== id),
          items: updatedItems
        };
      }),

      harvestLiveOrders: (confirmedOrders: any[], codeToProductIdMap: Record<string, string>, codeToPriceRulesMap: Record<string, string>) => set((state) => {
        let updatedItems = [...state.items];
        const newSales: Sale[] = [];
        const sessionId = state.currentLiveSessionId || `live-${new Date().toISOString()}`;

        for (const order of confirmedOrders) {
          if (!order.items) continue;
          
          for (const item of order.items) {
            const productId = codeToProductIdMap[item.product_code];
            if (!productId) continue;

            // 1. 根據 ID 找到商品名稱，以此名稱進行跨批次扣庫 (FIFO)
            const templateItem = state.items.find(i => i.id === productId);
            if (!templateItem) continue;
            const productName = templateItem.name;

            // 2. 計算單價 (支持階梯價)
            const priceRule = codeToPriceRulesMap[item.product_code] || "0";
            let unitPrice = 0;

            if (!priceRule.includes(":")) {
              unitPrice = Number(priceRule);
            } else {
              const rules = priceRule.split(",").map(r => {
                const [q, p] = r.split(":").map(s => Number(s.trim()));
                return { q, p };
              }).sort((a, b) => b.q - a.q);
              const match = rules.find(r => item.quantity >= r.q);
              // 支援組合總價 (如 3:700 代表 3 個共 700) -> 單價 = 700 / 3
              unitPrice = match ? (match.p / match.q) : (rules[rules.length - 1]?.p || 0);
            }

            // [防呆] 如果完全沒設價格，預設以「成本 + 50」作為預估售價，避免毛利顯示大噴血
            if (unitPrice <= 0) {
              unitPrice = (templateItem.localCostLanded || 0) + 50;
            }

            // 3. FIFO 扣庫邏輯：找到所有同名商品，由舊到新扣除
            let remainingToSell = item.quantity;
            const sameNamedItems = updatedItems
              .filter(i => i.name.toLowerCase().trim() === productName.toLowerCase().trim())
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            for (const batchItem of sameNamedItems) {
              if (remainingToSell <= 0) break;
              // [SHORTAGE] 無限支援負數扣除，優先從最新/舊批次扣除 (這裡依序扣，最後一個會變負數)
              const sellFromThisItem = remainingToSell;
              const revenueFromThisItem = unitPrice * sellFromThisItem;
              const profitFromThisItem = (unitPrice - batchItem.localCostLanded) * sellFromThisItem;

              newSales.push({
                id: crypto.randomUUID(),
                itemId: batchItem.id,
                itemName: batchItem.name,
                buyerName: order.buyer_name || order.fb_user_name,
                quantity: sellFromThisItem,
                unitPrice: unitPrice,
                totalRevenue: revenueFromThisItem,
                profit: profitFromThisItem,
                batchId: batchItem.batchId,
                source: "live",
                liveSessionId: sessionId,
                createdAt: new Date().toISOString()
              });

              // 更新本地複本中的數量
              updatedItems = updatedItems.map(i => 
                i.id === batchItem.id 
                  ? { ...i, quantity: i.quantity - sellFromThisItem }
                  : i
              );

              remainingToSell -= sellFromThisItem;
            }
          }
        }

        return {
          items: updatedItems,
          sales: [...state.sales, ...newSales],
          lastHarvestedOrders: confirmedOrders
        };
      }),

      clearData: () => set({ batches: [], items: [], shipments: [], sales: [] }),

      mergeData: (incoming: Partial<AppState>) => set((state) => {
        const mergeById = <T extends { id: string }>(existing: T[], incomingItems: T[] = []) => {
          const map = new Map(existing.map(item => [item.id, item]));
          incomingItems.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        };

        return {
          batches: mergeById(state.batches, incoming.batches),
          items: mergeById(state.items, incoming.items),
          shipments: mergeById(state.shipments, incoming.shipments),
          sales: mergeById(state.sales, incoming.sales),
          geminiApiKey: incoming.geminiApiKey || state.geminiApiKey
        };
      }),

      mergeItemsByName: () => set((state) => {
        // 1. Merge Batches first
        const batchGroups: Record<string, Batch[]> = {};
        state.batches.forEach(b => {
          const name = b.name.trim();
          if (!batchGroups[name]) batchGroups[name] = [];
          batchGroups[name].push(b);
        });

        const newBatches: Batch[] = [];
        const batchIdMap: Record<string, string> = {}; // oldBatchId -> newBatchId

        Object.values(batchGroups).forEach(group => {
          if (group.length === 0) return;
          const target = group[0];
          newBatches.push(target);
          group.slice(1).forEach(other => {
            batchIdMap[other.id] = target.id;
          });
        });

        // 2. Merge Items, and re-point to newBatchId
        const itemGroups: Record<string, Item[]> = {};
        state.items.forEach(item => {
          const name = item.name.trim();
          const targetBatchId = batchIdMap[item.batchId] || item.batchId;
          const groupKey = `${targetBatchId}_${name}`; // Group by batch + name
          
          if (!itemGroups[groupKey]) itemGroups[groupKey] = [];
          itemGroups[groupKey].push({
            ...item,
            batchId: targetBatchId
          });
        });

        const newItems: Item[] = [];
        const itemIdMap: Record<string, string> = {}; // oldItemId -> newItemId

        Object.values(itemGroups).forEach(group => {
          if (group.length === 0) return;
          const target = group[0];
          const others = group.slice(1);
          let totalQuantity = target.quantity;
          others.forEach(other => {
            totalQuantity += other.quantity;
            itemIdMap[other.id] = target.id;
          });
          newItems.push({ 
            ...target, 
            quantity: totalQuantity,
            suggestedPrice: target.suggestedPrice || others.find(o => o.suggestedPrice)?.suggestedPrice || "" 
          });
        });

        // 3. Update Sales and Shipments
        const updatedSales = state.sales.map(sale => ({
          ...sale,
          itemId: itemIdMap[sale.itemId] || sale.itemId,
          batchId: batchIdMap[sale.batchId || ""] || sale.batchId
        }));

        const updatedShipments = state.shipments.map(s => ({
          ...s,
          batchId: batchIdMap[s.batchId] || s.batchId
        }));

        // 4. Update live mappings
        const updatedMappings = state.liveProductMappings.map(m => ({
          ...m,
          productId: itemIdMap[m.productId] || m.productId
        }));

        return {
          batches: newBatches,
          items: newItems,
          sales: updatedSales,
          shipments: updatedShipments,
          liveProductMappings: updatedMappings
        };
      })
    }),
    {
      name: "local-first-mvp-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        batches: state.batches,
        items: state.items,
        shipments: state.shipments,
        sales: state.sales,
        geminiApiKey: state.geminiApiKey,
        fbPageToken: state.fbPageToken,
        backendUrl: state.backendUrl,
        shippingFee: state.shippingFee,
        currentLiveSessionId: state.currentLiveSessionId,
        liveProductMappings: state.liveProductMappings,
        orderMirror: state.orderMirror,
        processedIdMirror: state.processedIdMirror,
        adminSecret: state.adminSecret,
        lastHarvestedOrders: state.lastHarvestedOrders,
        language: state.language,
      })
    }
  )
);

// Helper functions (formerly in store.ts context)
export function calculateMonthlyStats(sales: Sale[]) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthlySales = sales.filter((sale) => {
    const saleDate = new Date(sale.createdAt)
    return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear
  })

  const totalRevenue = monthlySales.reduce((sum, sale) => sum + sale.totalRevenue, 0)
  const totalProfit = monthlySales.reduce((sum, sale) => sum + sale.profit, 0)

  return { totalRevenue, totalProfit, salesCount: monthlySales.length }
}

export function getLowStockItems(items: Item[], threshold = 5) {
  return items.filter((p) => p.quantity <= threshold && p.quantity > 0)
}

export function getOutOfStockItems(items: Item[]) {
  return items.filter((p) => p.quantity === 0)
}

// [SHORTAGE] 欠貨追蹤：取得庫存為負數的品項
export function getShortageItems(items: Item[]) {
  return items.filter((p) => p.quantity < 0)
}
