import { useState, useEffect, useRef } from "react"

interface PollingOptions {
  orderId: string
  backendUrl: string
  signature: string | null
  interval?: number
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

export function useAIPolling({
  orderId,
  backendUrl,
  signature,
  interval = 2000,
  onSuccess,
  onError
}: PollingOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const startPolling = () => {
    setIsProcessing(true)
    setError(null)
    
    // Initial check
    checkStatus()
    
    // Start interval
    pollingRef.current = setInterval(checkStatus, interval)
  }

  const checkStatus = async () => {
    try {
      const url = `${backendUrl}/api/checkout/${orderId}/status${signature ? `?s=${signature}` : ''}`
      const res = await fetch(url)
      
      if (!res.ok) throw new Error("無法獲取辨識狀態")
      
      const result = await res.json()
      
      if (result.ai_status === "done") {
        stopPolling()
        setIsProcessing(false)
        if (onSuccess) onSuccess(result.data)
      } else if (result.ai_status === "failed") {
        stopPolling()
        setIsProcessing(false)
        const errorMsg = result.ai_error || "AI 辨識失敗"
        setError(errorMsg)
        if (onError) onError(errorMsg)
      } else if (result.ai_status === "processing") {
        setIsProcessing(true)
      } else {
        // idle or other
        setIsProcessing(false)
        stopPolling()
      }
    } catch (err: any) {
      console.error("[Polling Error]", err)
      // We don't stop on single network error, just keep trying
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  return {
    isProcessing,
    error,
    startPolling,
    stopPolling
  }
}
