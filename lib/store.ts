import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type AppTab = "dashboard" | "batch" | "digitize" | "shipments" | "inventory" | "sales" | "settings";

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
  quantity: number;
  unitPrice: number; // 售出單價
  totalRevenue: number;
  profit: number; // (unitPrice - localCostLanded) * quantity
  batchId?: string; // The batch this sale is attributed to (optional during creation)
  createdAt: string;
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

  // Domain Actions
  addBatch: (batch: Omit<Batch, "id" | "createdAt" | "status"> & { id?: string }) => void;
  updateBatchStatus: (id: string, status: "active" | "completed") => void;

  addItem: (item: Omit<Item, "id" | "createdAt" | "localCostBase" | "localCostLanded"> & { id?: string }) => void;
  updateItemQuantity: (id: string, quantityDelta: number) => void;
  removeItem: (id: string) => void;
  addShipment: (shipment: Pick<Shipment, "batchId" | "totalCostTWD" | "amortizationMethod">) => void;
  addSale: (sale: Omit<Sale, "id" | "createdAt" | "profit" | "totalRevenue">) => void;
  setGeminiApiKey: (key: string) => void;

  // Global Actions
  clearData: () => void;
  mergeData: (data: Partial<AppState>) => void;
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
        const batch = state.batches.find(b => b.id === itemData.batchId);
        const exchangeRate = batch?.exchangeRate || 781;
        const localCostBase = itemData.foreignCost * (1000 / exchangeRate);

        return {
          items: [...state.items, {
            ...itemData,
            id: itemData.id || crypto.randomUUID(),
            localCostBase,
            localCostLanded: localCostBase,
            createdAt: new Date().toISOString()
          }],
        };
      }),

      setGeminiApiKey: (key: string) => set({ geminiApiKey: key }),

      updateItemQuantity: (id, quantityDelta) => set((state) => ({
        items: state.items.map(item =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + quantityDelta) }
            : item
        )
      })),

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
          if (item.quantity <= 0) continue;

          const sellFromThisItem = Math.min(item.quantity, remainingToSell);
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
        geminiApiKey: state.geminiApiKey
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
