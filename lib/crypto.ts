
/**
 * 使用 Web Crypto API 生成 HMAC-SHA256 簽名
 * 用於管理員指令驗證 (X-Admin-Signature)
 */
export async function generateAdminSignature(secret: string, timestamp: string): Promise<string> {
    if (!secret) return "NO_SECRET_SET";
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(`admin:${timestamp}`);
    
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        msgData
    );
    
    // Convert to hex string
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
