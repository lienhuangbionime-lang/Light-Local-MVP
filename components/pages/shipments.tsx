"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Truck, RefreshCcw, Package } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export function ShipmentsPage() {
    const { batches, shipments, addShipment } = useAppStore()
    const { toast } = useToast()

    const [selectedBatchId, setSelectedBatchId] = useState("")
    const [totalCostVND, setTotalCostVND] = useState("")
    const [method, setMethod] = useState<"count" | "weight">("weight")

    const activeBatch = batches.find((b) => b.id === selectedBatchId)

    const handleSubmit = () => {
        if (!selectedBatchId || !activeBatch) {
            toast({ title: "請選擇批次", variant: "destructive" })
            return
        }

        const costVnd = parseFloat(totalCostVND)
        if (!costVnd || costVnd <= 0) {
            toast({ title: "請輸入有效的運費", variant: "destructive" })
            return
        }

        // Convert VND to TWD
        const costTwd = costVnd * (1000 / activeBatch.exchangeRate)

        addShipment({
            batchId: selectedBatchId,
            totalCostTWD: costTwd,
            amortizationMethod: method
        })

        toast({
            title: "物流費登錄成功",
            description: `已將運費 (約 $${Math.round(costTwd).toLocaleString()} TWD) 加入批次 ${activeBatch?.name}`,
        })

        setSelectedBatchId("")
        setTotalCostVND("")
        setMethod("weight")
    }

    return (
        <div className="space-y-4">
            <header className="pt-2">
                <h1 className="text-2xl font-bold text-foreground">物流費登錄與攤提</h1>
                <p className="text-sm text-muted-foreground">輸入國際運費，系統將自動分攤至該批商品成本</p>
            </header>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        新增運費請款單
                    </CardTitle>
                    <CardDescription>
                        依據不同攤提策略將總運費加載至每件衣服
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="batch">1. 選擇批次</Label>
                        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="選擇隸屬的進貨批次" />
                            </SelectTrigger>
                            <SelectContent>
                                {batches.length === 0 ? (
                                    <SelectItem value="none" disabled>尚無批次，請先建立</SelectItem>
                                ) : (
                                    batches.map((batch) => (
                                        <SelectItem key={batch.id} value={batch.id}>
                                            {batch.name} (匯率: {batch.exchangeRate})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="totalCost">2. 輸入總運費 (VND)</Label>
                        <Input
                            id="totalCost"
                            type="number"
                            value={totalCostVND}
                            onChange={(e) => setTotalCostVND(e.target.value)}
                            placeholder="例：3000"
                            className="mt-1 font-medium"
                        />
                    </div>

                    <div>
                        <Label htmlFor="method">3. 攤提算法</Label>
                        <Select value={method} onValueChange={(m: "count" | "weight") => setMethod(m)}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weight">按重量拆分 (服飾業推薦 - 如冬裝重、夏裝輕)</SelectItem>
                                <SelectItem value="count">按件數均攤 (適合單一且重量接近商品)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={handleSubmit} className="w-full h-12 text-base mt-2">
                        <Check className="h-5 w-5 mr-2" />
                        確認登錄及攤提
                    </Button>
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        已出帳單據
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {shipments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">尚無物流單據</p>
                    ) : (
                        <div className="space-y-2">
                            {shipments.slice(-5).reverse().map((shipment) => {
                                const b = batches.find(bx => bx.id === shipment.batchId)
                                return (
                                    <div
                                        key={shipment.id}
                                        className="flex flex-col py-3 border-b border-border last:border-0"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="font-medium text-sm text-foreground">
                                                {b ? b.name : "未知批次"}
                                            </p>
                                            <p className="font-semibold">${shipment.totalCostTWD.toLocaleString()}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <RefreshCcw className="h-3 w-3" />
                                                {shipment.amortizationMethod === "weight" ? "按重量拆分" : "按件數均攤"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(shipment.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}
