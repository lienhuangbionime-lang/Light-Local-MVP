import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(req: NextRequest) {
    try {
        const { imageBase64, apiKey: clientApiKey, mimeType = "image/jpeg" } = await req.json()

        if (!imageBase64) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 })
        }

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

        // Initialize the New SDK
        const ai = new GoogleGenAI({ apiKey })

        const prompt = "Extract the line items from this receipt or invoice. Return ONLY a valid JSON array where each object has 'name' (string, the product name), 'foreignPrice' (number, the unit cost found), and 'quantity' (number). Do not include any markdown formatting, just the raw JSON."

        // Use the model the user manually edited: gemini-3.1-flash-lite-preview
        const result = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview", // Reverting to a known stable model identifier as default
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: imageBase64,
                                mimeType: mimeType
                            }
                        }
                    ]
                }
            ],
            config: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        })

        const textResponse = result.text

        if (!textResponse) {
            return NextResponse.json({ error: "Could not parse image" }, { status: 500 })
        }

        try {
            const cleanedJson = textResponse.replace(/^```json\n|\n```$/g, "").trim()
            const parsedItems = JSON.parse(cleanedJson)
            return NextResponse.json({ items: parsedItems })
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON", textResponse)
            return NextResponse.json({ error: "Invalid JSON from OCR" }, { status: 500 })
        }

    } catch (error: any) {
        console.error("OCR Route Error:", error)
        return NextResponse.json({ error: `Gemini SDK 錯誤: ${error.message || "發生未知錯誤"}` }, { status: 500 })
    }
}
