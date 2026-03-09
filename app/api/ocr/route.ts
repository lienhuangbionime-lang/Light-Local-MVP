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

        const prompt =
            "Extract the line items from this receipt or invoice. Return ONLY a valid JSON array where each object has 'name' (string, the product name), 'foreignPrice' (number, the unit cost found), and 'quantity' (number). Do not include any markdown formatting, just the raw JSON."

        // 使用目前文件推薦的 gemini-2.5-flash 並加強錯誤紀錄
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType,
                                    data: cleanedBase64,
                                },
                            },
                        ],
                    },
                ],
            }),
        })

        const rawText = await response.text()

        if (!response.ok) {
            console.error("Gemini API Error status:", response.status)
            console.error("Gemini API Error body:", rawText)
            let errorDetail: any = null
            try {
                errorDetail = JSON.parse(rawText)
            } catch {
                // ignore
            }
            return NextResponse.json(
                {
                    error:
                        errorDetail?.error?.message ||
                        "Gemini API 請求失敗，請稍後再試",
                },
                { status: response.status }
            )
        }

        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error("Gemini 回傳非 JSON 內容:", rawText)
            return NextResponse.json(
                { error: "Gemini 回傳格式非 JSON，請稍後再試" },
                { status: 502 }
            )
        }

        const textResponse =
            data.candidates?.[0]?.content?.parts
                ?.map((p: any) => p.text || "")
                .join("") || ""

        if (!textResponse) {
            console.error("Empty response from Gemini:", data)
            return NextResponse.json(
                { error: "無法從圖片中辨識出內容" },
                { status: 500 }
            )
        }

        try {
            // 有些情況仍會包在 ```json 區塊裡
            const cleanedJson = textResponse
                .replace(/^```json\s*|\s*```$/g, "")
                .trim()
            const parsedItems = JSON.parse(cleanedJson)
            return NextResponse.json({ items: parsedItems })
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", textResponse)
            return NextResponse.json(
                {
                    error: "JSON 解析失敗，請再試一次或手動輸入",
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
