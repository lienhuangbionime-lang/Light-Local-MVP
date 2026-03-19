"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"

export function BatchPage() {
    const { addBatch, batches } = useAppStore()
    const { toast } = useToast()
    const { t } = useTranslation()

    const [batchName, setBatchName] = useState("")
    // Users input Vietnam exchange rate in format like "781" which means 1,000,000 VND = 781 TWD
    const [exchangeRateInput, setExchangeRateInput] = useState("781")

    const handleSubmit = () => {
        if (!batchName.trim()) {
            toast({ title: t("batch.error_name"), variant: "destructive" })
            return
        }

        const unformattedRate = parseFloat(exchangeRateInput)
        if (!unformattedRate || unformattedRate <= 0) {
            toast({ title: t("batch.error_rate"), variant: "destructive" })
            return
        }

        // We store the exact number the user types in (e.g. 781)
        addBatch({
            name: batchName,
            exchangeRate: unformattedRate
        })

        toast({
            title: t("batch.toast_success_title"),
            description: t("batch.toast_success_desc").replace("{name}", batchName).replace("{rate}", unformattedRate.toString()),
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
                <h1 className="text-2xl font-bold text-foreground">{t("batch.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("batch.subtitle")}</p>
            </header>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {t("batch.add_title")}
                    </CardTitle>
                    <CardDescription>
                        {t("batch.add_desc")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="batchName">{t("batch.name_label")}</Label>
                        <Input
                            id="batchName"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            placeholder={t("batch.name_placeholder")}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="exchangeRate" className="flex items-center gap-2">
                            {t("batch.rate_label")}
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
                            {t("batch.preview_calc").replace("{twd}", previewTwd.toString())}
                        </p>
                    </div>

                    <Button onClick={handleSubmit} className="w-full h-12 text-base mt-2">
                        <Check className="h-5 w-5 mr-2" />
                        {t("batch.submit_btn")}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {t("batch.recent_title")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {batches.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t("batch.no_recent")}
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
                                            {t("batch.locked_rate").replace("{rate}", batch.exchangeRate.toString())}
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
