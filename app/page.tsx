"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "@/lib/i18n"
import { BottomNav, type TabId } from "@/components/bottom-nav"
import { DashboardPage } from "@/components/pages/dashboard"
import { DigitizePage } from "@/components/pages/digitize"
import { BatchPage } from "@/components/pages/batch"
import { ShipmentsPage } from "@/components/pages/shipments"
import { InventoryPage } from "@/components/pages/inventory"
import { SalesPage } from "@/components/pages/sales"
import { SettingsPage } from "@/components/pages/settings"
import { LivePage } from "@/components/pages/live"
import { Toaster } from "@/components/ui/toaster"

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")
  const [isMounted, setIsMounted] = useState(false)
  const { t } = useTranslation()

  // Handle hydration
  useEffect(() => {
    console.log("[App] Client-side mounted and initialized.");
    setIsMounted(true)
    
    // Add global error handler for better Vercel diagnostics
    const handleError = (event: ErrorEvent) => {
      console.error("[CRITICAL CLIENT EXCEPTION]:", event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [])

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-medium">{t("app.loading")}</div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Main Content Area */}
      <main className="pb-24 pt-4 px-4 max-w-lg mx-auto h-full min-h-[100dvh]">
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "batch" && <BatchPage />}
        {activeTab === "shipments" && <ShipmentsPage />}
        {activeTab === "digitize" && <DigitizePage />}
        {activeTab === "inventory" && <InventoryPage />}
        {activeTab === "sales" && <SalesPage />}
        {activeTab === "live" && <LivePage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

export default function Home() {
  return (
    <AppContent />
  )
}
