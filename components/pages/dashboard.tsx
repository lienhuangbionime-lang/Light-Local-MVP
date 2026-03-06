"use client"

import { useAppStore } from "@/lib/store"
import { calculateMonthlyStats, getLowStockItems } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign, AlertTriangle, Package, Layers, BarChart3 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DashboardPage() {
  const { sales, items, batches } = useAppStore()
  const stats = calculateMonthlyStats(sales)
  const lowStockItems = getLowStockItems(items)

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">總覽看板</h1>
        <p className="text-sm text-muted-foreground">本月業績與庫存狀況</p>
      </header>

      {/* Main Stats Cards - Condensed */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-primary text-primary-foreground p-3 flex flex-col items-center justify-center">
          <TrendingUp className="h-4 w-4 mb-1 opacity-80" />
          <p className="text-xs opacity-80">預利潤</p>
          <p className="text-sm font-bold">${Math.round(stats.totalProfit).toLocaleString()}</p>
        </Card>
        <Card className="bg-secondary p-3 flex flex-col items-center justify-center">
          <DollarSign className="h-4 w-4 mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">營收</p>
          <p className="text-sm font-bold">${Math.round(stats.totalRevenue).toLocaleString()}</p>
        </Card>
        <Card className="p-3 flex flex-col items-center justify-center">
          <Package className="h-4 w-4 mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">銷量</p>
          <p className="text-sm font-bold">{stats.salesCount} 筆</p>
        </Card>
      </div>

      <Tabs defaultValue="batches" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-12">
          <TabsTrigger value="batches" className="text-xs py-2">批次獲利</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs py-2">庫存預警</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs py-2">最近銷售</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                批次財務看板
              </CardTitle>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無批次資料</p>
              ) : (
                <div className="space-y-3">
                  {batches.slice().reverse().map((batch) => {
                    const batchItems = items.filter(i => i.batchId === batch.id);
                    const batchSales = sales.filter(s => s.batchId === batch.id);

                    const totalBatchCost = batchItems.reduce(
                      (sum, item) => sum + (item.localCostLanded * item.quantity),
                      0
                    );
                    const totalProfit = batchSales.reduce((sum, s) => sum + s.profit, 0);

                    return (
                      <div
                        key={batch.id}
                        className="p-3 rounded-lg bg-muted/30 border border-border space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm truncate">{batch.name}</p>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            匯率 {batch.exchangeRate}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                          <div>
                            <p className="text-[10px] text-muted-foreground">投入總成本</p>
                            <p className="text-sm font-semibold">${Math.round(totalBatchCost).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">目前已銷利潤</p>
                            <p className={`text-sm font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {totalProfit >= 0 ? "+" : ""}${Math.round(totalProfit).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className={lowStockItems.length > 0 ? "border-amber-500/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${lowStockItems.length > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                />
                低庫存商品
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">庫存暫時充足</p>
              ) : (
                <div className="space-y-2">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          成本: ${Math.round(item.localCostLanded).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${item.quantity <= 2
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-600"
                          }`}
                      >
                        剩 {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                最近銷售紀錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  尚無銷售紀錄
                </p>
              ) : (
                <div className="space-y-2">
                  {sales.slice(-10).reverse().map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">{sale.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {sale.quantity} 件 x ${Math.round(sale.unitPrice).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-primary">
                          ${Math.round(sale.totalRevenue).toLocaleString()}
                        </p>
                        <p className={`text-xs font-medium ${sale.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {sale.profit >= 0 ? "+" : ""}${Math.round(sale.profit).toLocaleString()}
                        </p>
                        {sale.profit < 0 && (
                          <p className="text-[9px] text-destructive leading-none mt-1">⚠️ 賠錢售出</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
