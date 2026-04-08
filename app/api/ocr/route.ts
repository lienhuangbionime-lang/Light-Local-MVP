import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    try {
        const { imageBase64, apiKey: clientApiKey, mimeType = "image/jpeg" } = await req.json()

        if (!imageBase64) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 })
        }

        // 允許前端丟完整 data URL，例如 "data:image/png;base64,xxxx"
        const cleanedBase64 = imageBase64.includes(",")
            ? imageBase64.split(",")[1]
            : imageBase64

        const apiKey = clientApiKey || process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.warn("No GEMINI_API_KEY found. Returning mock data.")
            return NextResponse.json({
                items: [
                    { name: "Demo: Yellow T-Shirt", foreignPrice: 150000, quantity: 2 },
                    { name: "Demo: Denim Jacket", foreignPrice: 350000, quantity: 1 }
                ]
            })
        }


        // --- STEP 1: PURE OCR TRANSCRIPTION ---
        const ocrPrompt = "請把這張圖片中所有可見的文字，一字不漏地轉錄為純文字。不要翻譯、不要解釋、不要加任何說明，只輸出原始文字內容。"
        const modelName = process.env.GEMINI_VISION_MODEL || "models/gemma-4-31b-it"
        const cleanModelName = modelName.startsWith("models/") ? modelName : `models/${modelName}`
        const url = `https://generativelanguage.googleapis.com/v1beta/${cleanModelName}:generateContent?key=${apiKey}`
        
        const ocrResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: ocrPrompt },
                        { inline_data: { mime_type: mimeType, data: cleanedBase64 } }
                    ]
                }]
            })
        })

        if (!ocrResponse.ok) {
            const rawText = await ocrResponse.text()
            console.error("Gemini OCR Error:", rawText)
            return NextResponse.json({ error: "Gemini OCR 請求失敗" }, { status: ocrResponse.status })
        }

        const ocrData = await ocrResponse.json()
        const rawOcrText = ocrData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""

        if (!rawOcrText) {
            return NextResponse.json({ error: "無法從圖片中辨識出文字" }, { status: 500 })
        }

        // --- STEP 2: STRUCTURED PARSING FROM TEXT ---
        const parsePrompt = `
你是一位專業的「進貨單據解析小幫手」。請從下方的【OCR 轉錄文字】中，萃取出品項清單。
請【嚴格】回傳一個 JSON 陣列，每個物件包含：
- "name": (string) 產品品名
- "foreignPrice": (number) 外幣單價 (VND)
- "quantity": (number) 數量

【OCR 轉錄文字】：
${rawOcrText}

【規則】：
1. 僅回傳 JSON 陣列，禁止任何前導、後導文字。
2. 不要包含 Markdown 格式 (不要 \`\`\`json)。
3. 若數字中含有逗號 (如 150,000)，請移除逗號轉為數字 (150000)。
`

        const parseResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: parsePrompt }]
                }]
            })
        })

        if (!parseResponse.ok) {
             const rawText = await parseResponse.text()
             console.error("Gemini Parsing Error:", rawText)
             return NextResponse.json({ error: "Gemini 解析 CSV 失敗" }, { status: parseResponse.status })
        }

        const parseData = await parseResponse.json()
        const textResponse = parseData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""

        try {
            // Robust extraction of JSON array
            const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/)
            const cleanedJson = jsonMatch ? jsonMatch[0] : textResponse.replace(/^```json\s*|\s*```$/g, "").trim()
            
            const parsedItems = JSON.parse(cleanedJson)
            return NextResponse.json({ items: parsedItems })
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", textResponse)
            return NextResponse.json(
                {
                    error: "JSON 解析失敗，請手動輸入",
                    raw: textResponse,
                },
                { status: 500 }
            )
        }
    } catch (error: any) {
        console.error("OCR Route Error:", error)
        return NextResponse.json(
            { error: `伺服器錯誤: ${error.message || "未知錯誤"}` },
            { status: 500 }
        )
    }
}
