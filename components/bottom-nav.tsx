"use client"

import { LayoutDashboard, Camera, Package, ShoppingCart, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabId = "dashboard" | "digitize" | "inventory" | "sales" | "settings"

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "總覽", icon: LayoutDashboard },
  { id: "digitize", label: "進貨", icon: Camera },
  { id: "inventory", label: "庫存", icon: Package },
  { id: "sales", label: "銷售", icon: ShoppingCart },
  { id: "settings", label: "設定", icon: Settings },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                "active:scale-95 touch-manipulation",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-xs", isActive ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
