"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShoppingCart, Check, TrendingUp, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function SalesPage() {
  const { items, sales, addSale } = useAppStore()
  const { toast } = useToast()

  const [selectedItemName, setSelectedItemName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")

  // Group items by name for selection
  const groupedProducts = items.reduce((acc, item) => {
    const key = item.name.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = { name: item.name, totalQuantity: 0, avgLanded: 0 };
    }
    acc[key].totalQuantity += item.quantity;
    acc[key].avgLanded = (acc[key].avgLanded * (acc[key].totalQuantity - item.quantity) + item.localCostLanded * item.quantity) / (acc[key].totalQuantity || 1);
    return acc;
  }, {} as Record<string, { name: string; totalQuantity: number; avgLanded: number }>);

  const availableProducts = Object.values(groupedProducts).filter((p) => p.totalQuantity > 0)
  const selectedProduct = groupedProducts[selectedItemName.toLowerCase().trim()]

  const handleProductChange = (name: string) => {
    setSelectedItemName(name)
    const product = groupedProducts[name.toLowerCase().trim()]
    if (product) {
      // Suggest price with 30% margin based on average cost
      setUnitPrice(Math.round(product.avgLanded * 1.3).toString())
    }
  }

  const calculateProfit = () => {
    if (!selectedProduct) return 0
    const qty = parseInt(quantity) || 0
    const price = parseInt(unitPrice) || 0
    return (price - selectedProduct.avgLanded) * qty
  }

  const calculateTotal = () => {
    const qty = parseInt(quantity) || 0
    const price = parseInt(unitPrice) || 0
    return qty * price
  }

  const handleSubmit = () => {
    if (!selectedItemName) {
      toast({ title: "請選擇商品", variant: "destructive" })
      return
    }

    const qty = parseInt(quantity) || 0
    const price = parseInt(unitPrice) || 0

    if (qty <= 0) {
      toast({ title: "請輸入有效數量", variant: "destructive" })
      return
    }

    if (price <= 0) {
      toast({ title: "請輸入有效售價", variant: "destructive" })
      return
    }

    if (selectedProduct && qty > selectedProduct.totalQuantity) {
      toast({
        title: "庫存不足",
        description: `目前總庫存僅剩 ${selectedProduct.totalQuantity} 件`,
        variant: "destructive",
      })
      return
    }

    addSale({
      itemId: "fifo-virtual-id",
      itemName: selectedItemName,
      quantity: qty,
      unitPrice: price,
    })

    toast({
      title: "銷售成功",
      description: `已售出 ${selectedItemName} x ${qty}`,
    })

    // Reset form
    setSelectedItemName("")
    setQuantity("1")
    setUnitPrice("")
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">銷售記帳</h1>
        <p className="text-sm text-muted-foreground">記錄每筆銷售，自動依先進先出扣帳</p>
      </header>

      {/* Sale Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            新增銷售
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Select */}
          <div>
            <Label htmlFor="product">選擇商品款式 (跨批次自動扣帳)</Label>
            <Select value={selectedItemName} onValueChange={handleProductChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="選擇要銷售的商品款式" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    沒有可銷售的商品
                  </SelectItem>
                ) : (
                  availableProducts.map((product) => (
                    <SelectItem key={product.name} value={product.name}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          總庫存: {product.totalQuantity}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Product Info */}
          {selectedProduct && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">當前平均成本</span>
                <span className="font-medium">${Math.round(selectedProduct.avgLanded).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">累計總庫存</span>
                <span className="font-medium">{selectedProduct.totalQuantity} 件</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2 italic">* 系統將依先進先出 (FIFO) 自動從舊批次扣除</p>
            </div>
          )}

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantity">售出數量</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={selectedProduct?.totalQuantity || 999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="unitPrice">售出單價 (TWD)</Label>
                {selectedProduct && (
                  <button
                    onClick={() => setUnitPrice(Math.round(selectedProduct.avgLanded).toString())}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    填入保本價
                  </button>
                )}
              </div>
              <Input
                id="unitPrice"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="建議售價"
                className="mt-1"
              />
            </div>
          </div>

          {/* Calculation Preview */}
          {selectedProduct && unitPrice && (
            <div className={`p-3 rounded-lg border ${calculateProfit() < 0
              ? "bg-destructive/5 border-destructive/20"
              : "bg-primary/5 border-primary/20"
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm">銷售金額</span>
                <span className="font-semibold">${calculateTotal().toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  預估平均利潤
                </span>
                <div className="text-right">
                  <span
                    className={`font-semibold ${calculateProfit() >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {calculateProfit() >= 0 ? "+" : ""}${Math.round(calculateProfit()).toLocaleString()}
                  </span>
                  {calculateProfit() < 0 && (
                    <p className="text-[10px] text-destructive font-medium leading-none mt-1">⚠️ 低於成本出清中</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            className="w-full h-12 text-base"
            disabled={!selectedItemName}
          >
            <Check className="h-5 w-5 mr-2" />
            確認銷售
          </Button>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            近期銷售紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              尚無銷售紀錄
            </p>
          ) : (
            <div className="space-y-2">
              {sales.slice(-5).reverse().map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{sale.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.quantity} 件 x ${sale.unitPrice}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Math.round(sale.totalRevenue).toLocaleString()}</p>
                    <p className={`text-xs ${sale.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {sale.profit >= 0 ? "+" : ""}${Math.round(sale.profit).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
