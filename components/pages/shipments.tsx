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
import { useTranslation } from "@/lib/i18n"

export function ShipmentsPage() {
    const { batches, shipments, addShipment } = useAppStore()
    const { t } = useTranslation()
    const { toast } = useToast()

    const [selectedBatchId, setSelectedBatchId] = useState("")
    const [totalCostVND, setTotalCostVND] = useState("")
    const [method, setMethod] = useState<"count" | "weight">("weight")

    const activeBatch = batches.find((b) => b.id === selectedBatchId)

    const handleSubmit = () => {
        if (!selectedBatchId || !activeBatch) {
            toast({ title: t("shipments.toast_select_batch"), variant: "destructive" })
            return
        }

        const costVnd = parseFloat(totalCostVND)
        if (!costVnd || costVnd <= 0) {
            toast({ title: t("shipments.toast_invalid_cost"), variant: "destructive" })
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
            title: t("shipments.toast_success"),
            description: (t("shipments.toast_desc") || "已將運費 (約 ${twd} TWD) 加入批次 {name}")
                .replace("${twd}", Math.round(costTwd).toLocaleString())
                .replace("{name}", activeBatch?.name || ""),
        })

        setSelectedBatchId("")
        setTotalCostVND("")
        setMethod("weight")
    }

    return (
        <div className="space-y-4">
            <header className="pt-2">
                <h1 className="text-2xl font-bold text-foreground">{t("shipments.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("shipments.subtitle")}</p>
            </header>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        {t("shipments.card_title")}
                    </CardTitle>
                    <CardDescription>
                        {t("shipments.card_desc")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="batch">{t("shipments.select_batch")}</Label>
                        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder={t("shipments.select_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {batches.length === 0 ? (
                                    <SelectItem value="none" disabled>{t("shipments.no_batches_select")}</SelectItem>
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
                        <Label htmlFor="totalCost">{t("shipments.input_cost")}</Label>
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
                        <Label htmlFor="method">{t("shipments.amortization_method")}</Label>
                        <Select value={method} onValueChange={(m: "count" | "weight") => setMethod(m)}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weight">{t("shipments.method_weight")}</SelectItem>
                                <SelectItem value="count">{t("shipments.method_count")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={handleSubmit} className="w-full h-12 text-base mt-2">
                        <Check className="h-5 w-5 mr-2" />
                        {t("shipments.submit_btn")}
                    </Button>
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {t("shipments.history_title")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {shipments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t("shipments.no_history")}</p>
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
                                                {shipment.amortizationMethod === "weight" ? t("shipments.method_weight").split(" (")[0] : t("shipments.method_count").split(" (")[0]}
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
