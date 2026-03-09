import httpx
import asyncio

async def test_callback():
    # 模擬 7-11 eMap 回傳資料到我們的 API
    # 假設訂單 ID 是 ORD_DEBUG_123
    order_id = "ORD_DEBUG_123"
    backend_url = "http://127.0.0.1:10000"
    callback_url = f"http://127.0.0.1:3000/api/checkout/emap-callback?order_id={order_id}&backend={backend_url}"
    
    data = {
        "storeid": "123456",
        "storename": "科技門市",
        "storeaddress": "台北市科技路1號"
    }
    
    print(f"--- 模擬 7-11 eMap 回傳測試 ---")
    print(f"目標 URL: {callback_url}")
    print(f"傳送門市: {data['storename']} ({data['storeid']})")
    
    try:
        async with httpx.AsyncClient() as client:
            # 7-11 使用 POST 回傳
            # 我們預期會收到 303 Redirect 回到 /checkout/{order_id}
            response = await client.post(callback_url, data=data, follow_redirects=False)
            
            print(f"\n回應狀態碼: {response.status_code}")
            location = response.headers.get("Location")
            print(f"重導向位置: {location}")
            
            if response.status_code == 303 and f"/checkout/{order_id}" in location and "storeId=123456" in location:
                print("\n✅ 測試成功：API 正確接收門市資訊並導回結帳頁面！")
                print(f"🔗 最終跳轉網址驗證: OK")
            else:
                print("\n❌ 測試失敗：未收到預期的重導向。請確認 Next.js 是否正在運行於 port 3000。")
                
    except Exception as e:
        print(f"\n❌ 連線錯誤: {e}")
        print("💡 請確保您的 Next.js 伺服器正在執行 (npm run dev)")

if __name__ == "__main__":
    asyncio.run(test_callback())
