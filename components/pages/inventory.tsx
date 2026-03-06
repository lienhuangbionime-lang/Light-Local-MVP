"use client"

import { useState } from "react"
import { useAppStore, Item } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Search, Package, AlertTriangle, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function InventoryPage() {
  const { items, removeItem } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  // Group items by name for the UI
  const groupedItems = items.reduce((acc, item) => {
    const key = item.name.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = {
        name: item.name,
        totalQuantity: 0,
        totalValueLanded: 0,
        totalValueBase: 0,
        ids: [],
        items: []
      };
    }
    acc[key].totalQuantity += item.quantity;
    acc[key].totalValueLanded += item.localCostLanded * item.quantity;
    acc[key].totalValueBase += item.localCostBase * item.quantity;
    acc[key].ids.push(item.id);
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, {
    name: string;
    totalQuantity: number;
    totalValueLanded: number;
    totalValueBase: number;
    ids: string[];
    items: Item[];
  }>);

  const displayItems = Object.values(groupedItems).filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: "缺貨", className: "bg-destructive/10 text-destructive" }
    if (quantity <= 5) return { label: "低庫存", className: "bg-amber-500/10 text-amber-600" }
    return { label: "正常", className: "bg-emerald-500/10 text-emerald-600" }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">庫存管理</h1>
        <p className="text-sm text-muted-foreground">
          共 {Object.keys(groupedItems).length} 款商品，總庫存 {items.reduce((sum, p) => sum + p.quantity, 0)} 件
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋商品款式..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Item List */}
      {displayItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "找不到符合的商品" : "尚無庫存商品"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayItems.map((group) => {
            const stockStatus = getStockStatus(group.totalQuantity);
            const avgLanded = group.totalQuantity > 0 ? group.totalValueLanded / group.totalQuantity : 0;
            const avgBase = group.totalQuantity > 0 ? group.totalValueBase / group.totalQuantity : 0;

            return (
              <Card key={group.name} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4">
                    {/* Item Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate pr-2">
                          {group.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          平均成本: ${Math.round(avgLanded).toLocaleString()} (原: ${Math.round(avgBase).toLocaleString()})
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.className}`}>
                        {stockStatus.label}
                      </span>
                    </div>

                    {/* Quantity Info */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2 px-3">
                      <span className="text-sm font-medium">總庫存數量</span>
                      <div className="text-lg font-bold text-primary">
                        {group.totalQuantity} <span className="text-xs font-normal text-muted-foreground ml-1">件</span>
                      </div>
                    </div>

                    {/* Batch Details (Optional small text) */}
                    <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground underline decoration-primary/30">持倉明細 (先進先出)</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.filter(i => i.quantity > 0).map((item, idx) => {
                          const isOldStock = new Date().getTime() - new Date(item.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000;
                          return (
                            <div key={item.id} className="flex flex-col bg-muted/30 p-1.5 rounded border border-border/40 min-w-[120px]">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-semibold text-primary">批次 {idx + 1}</span>
                                {isOldStock && (
                                  <span className="bg-amber-100 text-amber-700 px-1 rounded-[2px] leading-tight">建議出清</span>
                                )}
                              </div>
                              <div className="text-[10px] mt-0.5 flex justify-between">
                                <span>數量: {item.quantity}</span>
                                <span className="text-muted-foreground ml-2">保本價: ${Math.round(item.localCostLanded)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Remove Action */}
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`確定要刪除「${group.name}」的所有批次紀錄嗎？這將無法復原。`)) {
                            group.ids.forEach(id => removeItem(id));
                            toast({ title: "商品已移除", description: `已移除 ${group.name}` })
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        移除此品項
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
