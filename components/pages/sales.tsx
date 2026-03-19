"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { generateAdminSignature } from "@/lib/crypto"
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
import { ShoppingCart, Check, TrendingUp, History, Radio, Download, CheckCircle2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"

export function SalesPage() {
  const {
    items,
    sales,
    addSale,
    lastHarvestedOrders,
    backendUrl,
    harvestLiveOrders,
    liveProductMappings,
    setLastHarvestedOrders,
  } = useAppStore()
  const { toast } = useToast()
  const { t } = useTranslation()

  const [selectedItemName, setSelectedItemName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [sourceFilter, setSourceFilter] = useState<"all" | "live" | "manual">("all")
  const [isHarvesting, setIsHarvesting] = useState(false)

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
      toast({ title: t("sales.error_no_product"), variant: "destructive" })
      return
    }

    const qty = parseInt(quantity) || 0
    const price = parseInt(unitPrice) || 0

    if (qty <= 0) {
      toast({ title: t("sales.error_invalid_qty"), variant: "destructive" })
      return
    }

    if (price <= 0) {
      toast({ title: t("sales.error_invalid_price"), variant: "destructive" })
      return
    }

    if (selectedProduct && qty > selectedProduct.totalQuantity) {
      toast({
        title: t("sales.error_out_of_stock"),
        description: t("sales.error_out_of_stock_desc").replace("{count}", selectedProduct.totalQuantity.toString()),
        variant: "destructive",
      })
      return
    }

    addSale({
      itemId: "fifo-virtual-id",
      itemName: selectedItemName,
      quantity: qty,
      unitPrice: price,
      source: "manual",
    })

    toast({
      title: t("sales.toast_success_title"),
      description: t("sales.toast_success_desc").replace("{name}", selectedItemName).replace("{qty}", qty.toString()),
    })

    // Reset form
    setSelectedItemName("")
    setQuantity("1")
    setUnitPrice("")
  }

  const filteredSales =
    sourceFilter === "all"
      ? sales
      : sales.filter((s) => (sourceFilter === "live" ? s.source === "live" : s.source !== "live"))

  const handleExportCSV = () => {
    if (lastHarvestedOrders.length === 0) {
      toast({ title: "尚無可匯出的收割資料" })
      return
    }

    // @ts-ignore
    const headers = t("sales.csv_headers", { returnObjects: true }) as string[]
    const rows = lastHarvestedOrders.map(o => [
      o.order_id,
      o.fb_user_name,
      o.phone ? `\t${o.phone}` : t("sales.csv_empty"),
      o.shipping_info || t("sales.csv_empty"),
      o.items.map((i: any) => `${i.product_code}${i.product_name ? ": " + i.product_name : ""} x${i.quantity}`).join("; "),
      o.status
    ])

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `harvest-orders-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const handleHarvestConfirmedOrders = async () => {
    setIsHarvesting(true)
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const sig = await generateAdminSignature(useAppStore.getState().adminSecret, ts)
      
      const res = await fetch(`${backendUrl}/api/seller/harvest`, {
        method: "POST",
        headers: {
          "X-Admin-Signature": sig,
          "X-Admin-Timestamp": ts
        }
      })
      if (!res.ok) throw new Error("backend_error")
      const data = await res.json()
      const orders = data.harvested_orders || []

      if (orders.length === 0) {
        toast({ title: t("sales.error_no_harvest_orders") })
        return
      }

      const productIdMapping: Record<string, string> = {}
      const priceMapping: Record<string, string> = {}
      liveProductMappings.forEach((m) => {
        const code = (m.code || "").trim().toUpperCase()
        if (!code) return
        productIdMapping[code] = m.productId
        priceMapping[code] = m.priceRule
      })

      harvestLiveOrders(orders, productIdMapping, priceMapping)
      setLastHarvestedOrders(orders)
      toast({ title: t("sales.toast_harvest_success").replace("{count}", orders.length.toString()) })
    } catch {
      toast({ title: t("sales.toast_harvest_error"), description: t("sales.toast_harvest_error_desc"), variant: "destructive" })
    } finally {
      setIsHarvesting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">{t("sales.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("sales.subtitle")}
        </p>
      </header>

      {/* Sale Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t("sales.add_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Select */}
          <div>
            <Label htmlFor="product">{t("sales.product_label")}</Label>
            <Select value={selectedItemName} onValueChange={handleProductChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("sales.product_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {t("sales.no_products")}
                  </SelectItem>
                ) : (
                  availableProducts.map((product) => (
                    <SelectItem key={product.name} value={product.name}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("sales.total_stock").replace("{count}", product.totalQuantity.toString())}
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
                <span className="text-muted-foreground">{t("sales.avg_cost")}</span>
                <span className="font-medium">${Math.round(selectedProduct.avgLanded).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t("sales.total_stock_acc")}</span>
                <span className="font-medium">{selectedProduct.totalQuantity} 件</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2 italic">{t("sales.fifo_hint")}</p>
            </div>
          )}

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantity">{t("sales.quantity_label")}</Label>
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
                <Label htmlFor="unitPrice">{t("sales.price_label")}</Label>
                {selectedProduct && (
                  <button
                    onClick={() => setUnitPrice(Math.round(selectedProduct.avgLanded).toString())}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    {t("sales.suggest_price_btn")}
                  </button>
                )}
              </div>
              <Input
                id="unitPrice"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={t("sales.price_placeholder")}
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
                <span className="text-sm">{t("sales.revenue_label")}</span>
                <span className="font-semibold">${calculateTotal().toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("sales.profit_label")}
                </span>
                <div className="text-right">
                  <span
                    className={`font-semibold ${calculateProfit() >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {calculateProfit() >= 0 ? "+" : ""}${Math.round(calculateProfit()).toLocaleString()}
                  </span>
                  {calculateProfit() < 0 && (
                    <p className="text-[10px] text-destructive font-medium leading-none mt-1">{t("sales.loss_warning")}</p>
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
            {t("sales.submit_btn")}
          </Button>
        </CardContent>
      </Card>

      {/* 🔴 直播收割（與一般銷售同類型） */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("sales.harvest_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("sales.harvest_desc")}
          </p>
          <Button
            className="w-full h-11 text-base font-semibold"
            onClick={handleHarvestConfirmedOrders}
            disabled={isHarvesting}
          >
            <CheckCircle2 className={`h-5 w-5 mr-2 ${isHarvesting ? "animate-spin" : ""}`} />
            {t("sales.harvest_btn")}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            {t("sales.harvest_hint")}
          </p>
        </CardContent>
      </Card>

      {/* 🟢 本次收割清單 (從直播頁面移過來) */}
      {lastHarvestedOrders.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t("sales.harvest_list_title").replace("{count}", lastHarvestedOrders.length.toString())}
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" />
              {t("sales.export_csv")}
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 pl-4">{t("sales.buyer_col")}</TableHead>
                  <TableHead>{t("sales.content_col")}</TableHead>
                  <TableHead className="text-right pr-4">{t("sales.status_col")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastHarvestedOrders.map((order, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium pl-4">
                      <div className="text-sm truncate w-16">{order.buyer_name || order.fb_user_name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.items.map((it: any) => `${it.product_code}${it.product_name ? ": " + it.product_name : ""} x${it.quantity}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Badge variant="secondary" className="text-[10px] bg-background">{t("sales.harvested_badge")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Sales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            {t("sales.recent_title")}
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant={sourceFilter === "all" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setSourceFilter("all")}
            >
              {t("sales.filter_all")}
            </Button>
            <Button
              size="sm"
              variant={sourceFilter === "live" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setSourceFilter("live")}
            >
              <Radio className="h-3 w-3 mr-1" />
              {t("sales.filter_live")}
            </Button>
            <Button
              size="sm"
              variant={sourceFilter === "manual" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setSourceFilter("manual")}
            >
              {t("sales.filter_manual")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("sales.no_sales")}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredSales.slice(-5).reverse().map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{sale.itemName}</p>
                    {sale.buyerName && (
                      <p className="text-[10px] text-muted-foreground italic">{t("sales.buyer_label").replace("{name}", sale.buyerName)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {sale.quantity} 件 x ${Math.round(sale.unitPrice)}
                    </p>
                    {sale.source && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {t("sales.source_label").replace("{source}", sale.source === "live" ? t("sales.source_live") : t("sales.source_manual"))}
                        {sale.liveSessionId && t("sales.session_label").replace("{id}", sale.liveSessionId)}
                      </p>
                    )}
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
