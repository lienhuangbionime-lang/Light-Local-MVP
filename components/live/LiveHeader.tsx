import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n"

export const LiveHeader = ({ 
    isActive, 
    backendUrl, 
    connectionError
}: { 
    isActive: boolean; 
    backendUrl: string; 
    connectionError?: string | null;
}) => {
    const { t } = useTranslation()
    return (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-b pb-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
                    <div className={cn(
                        "p-2 rounded-xl shadow-sm flex items-center gap-2",
                        isActive ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                    )}>
                        <Radio className="h-6 w-6" />
                        <span className="text-xs font-bold leading-none">
                            {isActive ? t("live.header.active") : t("live.header.standby")}
                        </span>
                    </div>
                    <span className="hidden sm:inline">{t("live.header.title")}</span>
                </h1>
                <p className="text-sm text-muted-foreground font-medium pl-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
                    {t("live.header.subtitle")}
                </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
                 <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                    {backendUrl.replace("https://", "")}
                 </span>
                 <Badge 
                    variant={connectionError ? "destructive" : isActive ? "destructive" : "outline"}
                    className={cn(
                        "font-bold py-0.5 px-3",
                        connectionError ? "bg-red-600 animate-bounce" : isActive ? "bg-red-500 hover:bg-red-600" : "text-muted-foreground"
                    )}
                >
                    {connectionError ? `${t("live.header.error", { error: connectionError })}` : isActive ? t("live.header.live_active") : t("live.header.live_standby")}
                </Badge>
            </div>
        </header>
    )
}
