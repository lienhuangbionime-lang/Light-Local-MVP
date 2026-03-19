import { CardContent } from "@/components/ui/card"
import { Radio } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export const EmptyStateBanner = ({ backendUrl }: { backendUrl: string }) => {
    const { t } = useTranslation()
    return (
        <CardContent className="p-4 flex flex-col items-center justify-center min-h-[150px] text-muted-foreground gap-2">
            <Radio className="h-8 w-8 opacity-20 animate-pulse" />
            <div className="text-center">
                <p className="text-sm font-medium">{t("live.empty.title")}</p>
                <p className="text-[10px] opacity-70 mt-1">{t("live.empty.target")} <span className="font-mono text-primary">{backendUrl}</span></p>
                <p className="text-[10px] mt-2 max-w-[200px]">{t("live.empty.desc")}</p>
            </div>
        </CardContent>
    )
}
