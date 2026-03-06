"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Check, Calculator, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function BatchPage() {
    const { addBatch, batches } = useAppStore()
    const { toast } = useToast()

    const [batchName, setBatchName] = useState("")
    // Users input Vietnam exchange rate in format like "781" which means 1,000,000 VND = 781 TWD
    const [exchangeRateInput, setExchangeRateInput] = useState("781")

    const handleSubmit = () => {
        if (!batchName.trim()) {
            toast({ title: "請輸入批次名稱", variant: "destructive" })
            return
        }

        const unformattedRate = parseFloat(exchangeRateInput)
        if (!unformattedRate || unformattedRate <= 0) {
            toast({ title: "請輸入有效的匯率", variant: "destructive" })
            return
        }

        // We store the exact number the user types in (e.g. 781)
        addBatch({
            name: batchName,
            exchangeRate: unformattedRate
        })

        toast({
            title: "批次建立成功",
            description: `已建立 ${batchName}，鎖定匯率 ${unformattedRate}`,
        })

        setBatchName("")
        setExchangeRateInput("781")
    }

    // Preview Calculation
    const sampleVND = 1000000
    const rateForCalc = parseFloat(exchangeRateInput) || 781
    const previewTwd = Math.round(sampleVND * (rateForCalc / 1000000))

    return (
        <div className="space-y-4">
            <header className="pt-2">
                <h1 className="text-2xl font-bold text-foreground">進貨批次與匯率</h1>
                <p className="text-sm text-muted-foreground">鎖定當批匯率，統一管理進貨成本</p>
            </header>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        新增批次
                    </CardTitle>
                    <CardDescription>
                        設定越南批貨當下講定的匯率
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="batchName">批次名稱</Label>
                        <Input
                            id="batchName"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            placeholder="例：2024年3月 河內採購"
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="exchangeRate" className="flex items-center gap-2">
                            鎖定匯率 (百萬越盾兌換幾台幣)
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                            <Input
                                id="exchangeRate"
                                type="number"
                                value={exchangeRateInput}
                                onChange={(e) => setExchangeRateInput(e.target.value)}
                                placeholder="例：781"
                                className="w-full text-lg font-medium"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Calculator className="h-3 w-3" />
                            試算：1,000,000 VND = {previewTwd} TWD
                        </p>
                    </div>

                    <Button onClick={handleSubmit} className="w-full h-12 text-base mt-2">
                        <Check className="h-5 w-5 mr-2" />
                        建立批次
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        近期批次
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {batches.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            尚無批次紀錄
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {batches.slice(-5).reverse().map((batch) => (
                                <div
                                    key={batch.id}
                                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{batch.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            鎖定匯率: {batch.exchangeRate}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(batch.createdAt).toLocaleDateString()}
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
