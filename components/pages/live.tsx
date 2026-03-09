"use client"

import { useState, useEffect, useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Radio, Zap, Download, RefreshCw, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp, Minus } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"

// --- Smart Pricing Helper Sub-component ---
const PricingHelper = ({ 
    currentRule, 
    onApply, 
    baseCost 
}: { 
    currentRule: string; 
    onApply: (rule: string) => void; 
    baseCost: number 
}) => {
    const [tiers, setTiers] = useState<{ q: number; p: number }[]>([])
    
    // 初始化
    useEffect(() => {
        if (currentRule && currentRule.includes(":")) {
            const parsed = currentRule.split(",").map(r => {
                const [q, p] = r.split(":").map(s => Number(s.trim()))
                return { q, p }
            })
            setTiers(parsed)
        } else {
            // 預設 Cost + 90，並以 5 元為最小單位進位
            const p1 = Math.ceil((baseCost + 90) / 5) * 5
            setTiers([{ q: 1, p: p1 }, { q: 2, p: p1 * 2 }])
        }
    }, [currentRule, baseCost])

    const updateTier = (index: number, delta: number) => {
        const newTiers = [...tiers]
        newTiers[index].p += delta
        
        // 如果修改的是 2 件以上，嘗試連動後續件數
        if (index >= 1) {
            const newUnitPrice = newTiers[index].p / newTiers[index].q
            for (let i = index + 1; i < newTiers.length; i++) {
                newTiers[i].p = Math.round(newUnitPrice * newTiers[i].q)
            }
        } else if (index === 0) {
            // 修改 1 件，連動所有
            for (let i = 1; i < newTiers.length; i++) {
                newTiers[i].p = newTiers[0].p * newTiers[i].q
            }
        }
        setTiers(newTiers)
    }

    return (
        <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground mb-1">
                目前庫存均價：約{" "}
                <span className="font-semibold text-foreground">
                    ${Number.isFinite(baseCost) ? Math.round(baseCost) : 0}
                </span>
                /件
            </div>
            {tiers.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="text-sm font-medium">
                        {t.q} 件總價
                        <span className="ml-1 text-[11px] text-muted-foreground">
                            (約 ${Math.round(t.p / t.q)}/件)
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTier(i, -5)}>
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-16 text-center font-bold text-lg">${t.p}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTier(i, 5)}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-[10px] h-7 border-dashed" 
                onClick={() => setTiers([...tiers, { q: tiers.length + 1, p: Math.round((tiers[tiers.length-1].p / tiers[tiers.length-1].q) * (tiers.length + 1)) }])}>
                + 增加件數門檻
            </Button>
            <DialogFooter className="pt-2">
                <DialogClose asChild>
                    <Button
                        className="w-full"
                        onClick={() => onApply(tiers.map(t => `${t.q}:${t.p}`).join(", "))}
                    >
                        套用定價規則
                    </Button>
                </DialogClose>
            </DialogFooter>
        </div>
    )
}

export function LivePage() {
    const {
        items,
        batches,
        backendUrl,
        harvestLiveOrders,
        startNewLiveSession,
        sales,
        currentLiveSessionId,
    } = useAppStore()
    const { toast } = useToast()

    const [isLiveActive, setIsLiveActive] = useState(false)
    const [activeBatchId, setActiveBatchId] = useState<string>("")
    const [productMappings, setProductMappings] = useState<{ code: string; productId: string; priceRule: string }[]>([
        { code: "A", productId: "", priceRule: "" }
    ])
    const [harvestedOrders, setHarvestedOrders] = useState<any[]>([])
    const [isSyncing, setIsSyncing] = useState(false)
    const [liveStats, setLiveStats] = useState<Record<string, { pending: number; confirmed: number }>>({})

    // 0. 直播 x 銷售：本場直播的即時銷售摘要（整合 Sales 模組）
    const liveSalesForCurrentSession = useMemo(
        () =>
            sales.filter((s) =>
                currentLiveSessionId
                    ? s.source === "live" && s.liveSessionId === currentLiveSessionId
                    : s.source === "live"
            ),
        [sales, currentLiveSessionId]
    )

    const liveSalesStats = useMemo(() => {
        const totalRevenue = liveSalesForCurrentSession.reduce((sum, s) => sum + s.totalRevenue, 0)
        const totalProfit = liveSalesForCurrentSession.reduce((sum, s) => sum + s.profit, 0)
        return {
            count: liveSalesForCurrentSession.length,
            totalRevenue,
            totalProfit,
        }
    }, [liveSalesForCurrentSession])

    // 1. 直播前喚醒與心跳包 (防止 Render 休眠)
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isLiveActive) {
            const ping = async () => {
                try {
                    await fetch(`${backendUrl}/api/health`)
                    console.log("Keep-alive ping sent")
                } catch (e) {
                    console.error("Wake up ping failed", e)
                }
            }
            ping()
            interval = setInterval(ping, 5 * 60 * 1000) // 每 5 分鐘
        }
        return () => clearInterval(interval)
    }, [isLiveActive, backendUrl])

    // 1b. 獲取即時統計 (每 10 秒)
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isLiveActive) {
            const fetchStats = async () => {
                try {
                    const res = await fetch(`${backendUrl}/api/seller/stats`)
                    if (res.ok) {
                        const data = await res.json()
                        setLiveStats(data)
                    }
                } catch (e) {
                    console.error("Fetch stats failed", e)
                }
            }
            fetchStats()
            interval = setInterval(fetchStats, 10000)
        }
        return () => clearInterval(interval)
    }, [isLiveActive, backendUrl])

    // 2. 同步直播代號到後端
    const handleSyncProducts = async () => {
        setIsSyncing(true)
        try {
            const dict: Record<string, string> = {}
            productMappings.forEach(m => {
                if (m.code && m.productId) dict[m.code.toUpperCase()] = m.productId
            })

            const res = await fetch(`${backendUrl}/api/seller/active_products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dict)
            })

            if (res.ok) {
                // 同步成功後啟動一個新的直播場次 ID，供後續銷售紀錄標記來源
                startNewLiveSession()
                toast({ title: "同步成功", description: "今日直播代號已更新至雲端" })
                setIsLiveActive(true)
            } else {
                throw new Error("同步失敗")
            }
        } catch (error) {
            toast({ title: "同步錯誤", description: "請檢查後端網址是否正確", variant: "destructive" })
        } finally {
            setIsSyncing(false)
        }
    }

    // 3. 一鍵收割訂單
    const handleHarvest = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/seller/harvest`)
            if (!res.ok) throw new Error("後端回傳錯誤")
            const data = await res.json()
            const orders = data.harvested_orders || []

            if (orders.length > 0) {
                // 映射表：code -> productId, code -> priceRule
                const productIdMapping: Record<string, string> = {}
                const priceMapping: Record<string, string> = {}

                productMappings.forEach(m => {
                    productIdMapping[m.code.toUpperCase()] = m.productId
                    priceMapping[m.code.toUpperCase()] = m.priceRule
                })

                // 執行 Zustand Store 扣庫存與記錄銷售
                harvestLiveOrders(orders, productIdMapping, priceMapping)

                setHarvestedOrders(prev => [...orders, ...prev])
                toast({ title: `成功收割 ${orders.length} 筆訂!`, description: "庫存已自動扣除並計入銷售" })
            } else {
                toast({ title: "尚無可收割的訂單", description: "請確認客戶是否已在私訊中確認門市" })
            }
        } catch (error) {
            toast({ title: "收割失敗", description: "連線至後端時發生錯誤", variant: "destructive" })
        }
    }

    // 4. 匯出 CSV
    const handleExportCSV = () => {
        if (harvestedOrders.length === 0) return

        const headers = ["訂單編號", "客戶名稱", "手機", "7-11門市", "商品內容", "狀態"]
        const rows = harvestedOrders.map(o => [
            o.order_id,
            o.fb_user_name,
            o.phone || "未填",
            o.shipping_info || "未填",
            o.items.map((i: any) => `${i.product_code}x${i.quantity}`).join("; "),
            o.status
        ])

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `live-orders-${new Date().toISOString().split("T")[0]}.csv`
        link.click()
    }

    return (
        <div className="space-y-4 pb-10">
            <header className="flex items-center justify-between pt-2">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Radio className={isLiveActive ? "text-red-500 animate-pulse" : "text-muted-foreground"} />
                        直播模式
                    </h1>
                    <p className="text-sm text-muted-foreground">雲端接單 ➡️ 手機收割</p>
                </div>
                <Badge variant={isLiveActive ? "destructive" : "outline"}>
                    {isLiveActive ? "LIVE 直播中" : "未啟動"}
                </Badge>
            </header>


            {/* 1. 直播設定與代號綁定 */}
            <Card className="border-primary/20 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        今日直播代號與商品
                    </CardTitle>
                    <CardDescription>設定代號 (如 A, B) 與庫存商品的對應與售價</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-[10px]">歸屬批次</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={activeBatchId}
                            onChange={e => setActiveBatchId(e.target.value)}
                        >
                            <option value="">選擇批次...</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] text-muted-foreground">
                                今日直播參數與代號：可手動設定，或一鍵從庫存自動產生 A-Z 代號。
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => {
                                    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                                    const autoMappings = items.slice(0, alphabet.length).map((item, index) => ({
                                        code: alphabet[index],
                                        productId: item.id,
                                        priceRule: ""
                                    }))

                                    if (autoMappings.length === 0) return
                                    setProductMappings(autoMappings)
                                    toast({
                                        title: "已自動產生代號",
                                        description: `已為前 ${autoMappings.length} 項庫存商品配發 A-Z 代號，請確認後同步至雲端。`
                                    })
                                }}
                            >
                                自動載入庫存 A-Z
                            </Button>
                        </div>
                        {productMappings.map((mapping, index) => {
                            const stats = liveStats[mapping.code.toUpperCase()] || { pending: 0, confirmed: 0 }
                            return (
                                <div key={index} className="flex items-center gap-2 group">
                                    <div className="w-16 relative">
                                        <Input
                                            placeholder="代號"
                                            value={mapping.code}
                                            onChange={(e) => {
                                                const newMappings = [...productMappings]
                                                newMappings[index].code = e.target.value.toUpperCase()
                                                setProductMappings(newMappings)
                                            }}
                                            className="font-bold text-center"
                                        />
                                        {isLiveActive && (stats.pending > 0 || stats.confirmed > 0) && (
                                            <div className="absolute -top-2 -right-2 flex gap-1 scale-75 origin-bottom-left z-10">
                                                {stats.pending > 0 && (
                                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none px-1 h-4 min-w-[1rem] flex items-center justify-center">
                                                        {stats.pending}
                                                    </Badge>
                                                )}
                                                {stats.confirmed > 0 && (
                                                    <Badge variant="default" className="bg-green-500 hover:bg-green-500 px-1 h-4 min-w-[1rem] flex items-center justify-center">
                                                        {stats.confirmed}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={mapping.productId}
                                            onChange={(e) => {
                                                const newMappings = [...productMappings]
                                                newMappings[index].productId = e.target.value
                                                // 預設不自動帶價，改由「智慧算價助手」依據 localCostLanded 產生
                                                setProductMappings(newMappings)
                                            }}
                                        >
                                            <option value="">選擇庫存商品...</option>
                                            {items.map(item => (
                                                <option key={item.id} value={item.id}>{item.name} (存: {item.quantity})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32 flex items-center gap-1">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-9 px-2 flex-1 text-[10px] justify-between">
                                                    <span className="truncate">{mapping.priceRule || "設定價格"}</span>
                                                    <Zap className="h-3 w-3 text-yellow-500" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[300px]">
                                                <DialogHeader>
                                                    <DialogTitle>智慧算價助手</DialogTitle>
                                                </DialogHeader>
                                                <PricingHelper 
                                                    currentRule={mapping.priceRule}
                                                    baseCost={items.find(it => it.id === mapping.productId)?.localCostLanded || 0}
                                                    onApply={(rule) => {
                                                        const newMappings = [...productMappings]
                                                        newMappings[index].priceRule = rule
                                                        setProductMappings(newMappings)
                                                    }}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setProductMappings(productMappings.filter((_, i) => i !== index))}
                                        disabled={productMappings.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed"
                        onClick={() => setProductMappings([...productMappings, { code: "", productId: "", priceRule: "" }])}
                    >
                        <Plus className="h-3 w-3 mr-1" /> 新增代號
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        💡 階梯定價格式：`1:190, 2:175` (買1件190，買2件起每件175)
                    </p>

                    <Button
                        className="w-full mt-4"
                        onClick={handleSyncProducts}
                        disabled={isSyncing}
                    >
                        {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        啟動模式並同步字典
                    </Button>
                </CardContent>
            </Card>

            {/* 2. 收割按鈕 */}
            <div className="flex gap-2">
                <Button className="flex-1 py-6 text-lg font-bold shadow-lg" variant="default" onClick={handleHarvest}>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    📥 一鍵收割已確認訂單
                </Button>
                <Button variant="outline" size="icon" className="h-auto px-4" onClick={handleExportCSV}>
                    <Download className="h-5 w-5" />
                </Button>
            </div>

            {/* 3. 已確認清單 */}
            <Card>
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold">本次收割清單 ({harvestedOrders.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    {harvestedOrders.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            尚無資料，請點擊「一鍵收割」讀取數據
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">客戶</TableHead>
                                    <TableHead>內容</TableHead>
                                    <TableHead className="text-right">狀態</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {harvestedOrders.map((order, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">
                                            <div className="text-sm">{order.buyer_name || order.fb_user_name}</div>
                                            <div className="text-[10px] text-muted-foreground line-clamp-1">{order.shipping_info}</div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {order.items.map((it: any) => `${it.product_code}x${it.quantity}`).join(", ")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary" className="text-[10px]">已收割</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* 4. 直播 x 銷售整合：本場直播銷售摘要 */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Radio className="h-4 w-4" />
                        本場直播銷售摘要
                    </CardTitle>
                    <CardDescription className="text-xs">
                        即時查看本場直播收割後的營收與利潤，資料與「銷售記帳」頁面完全同步。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {liveSalesForCurrentSession.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            本場尚未有直播收割銷售紀錄。完成一鍵收割後會自動顯示於此。
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                                    <p className="text-xs text-muted-foreground">本場累計營收</p>
                                    <p className="text-lg font-semibold">
                                        ${Math.round(liveSalesStats.totalRevenue).toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                                    <p className="text-xs text-muted-foreground">本場累計毛利</p>
                                    <p
                                        className={`text-lg font-semibold ${
                                            liveSalesStats.totalProfit >= 0
                                                ? "text-emerald-600"
                                                : "text-destructive"
                                        }`}
                                    >
                                        {liveSalesStats.totalProfit >= 0 ? "+" : ""}
                                        {Math.round(liveSalesStats.totalProfit).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t pt-2 mt-1">
                                <p className="text-xs text-muted-foreground mb-2">
                                    近期直播銷售（最多 5 筆）
                                </p>
                                <div className="space-y-1.5">
                                    {liveSalesForCurrentSession.slice(-5).reverse().map((sale) => (
                                        <div
                                            key={sale.id}
                                            className="flex items-center justify-between text-xs py-1.5"
                                        >
                                            <div>
                                                <p className="font-medium">{sale.itemName}</p>
                                                {sale.buyerName && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        買家：{sale.buyerName}
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-muted-foreground">
                                                    {sale.quantity} 件 x ${sale.unitPrice}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">
                                                    ${Math.round(sale.totalRevenue).toLocaleString()}
                                                </p>
                                                <p
                                                    className={`text-[11px] ${
                                                        sale.profit >= 0
                                                            ? "text-emerald-600"
                                                            : "text-destructive"
                                                    }`}
                                                >
                                                    {sale.profit >= 0 ? "+" : ""}
                                                    {Math.round(sale.profit).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
