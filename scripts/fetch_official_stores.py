import httpx
import re
import json
import time
import os
from bs4 import BeautifulSoup

# 使用 Ibon 的 AJAX 接口，這比官方 EMAP 更穩定且容易解析
URL = "https://www.ibon.com.tw/retail_inquiry_ajax.aspx"

def get_stores_ibon(city):
    """從 Ibon 抓取特定縣市的所有門市"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.ibon.com.tw/retail_inquiry.aspx"
    }
    data = {
        "strTargetField": "COUNTY",
        "strKeyWords": city
    }
    
    try:
        r = httpx.post(URL, data=data, headers=headers, timeout=20.0)
        if r.status_code != 200:
            print(f"  [Error] {city} failed: {r.status_code}")
            return []
        
        # Ibon 回應為 UTF-8，使用 r.content 讓 BeautifulSoup 正確解析
        text = r.content.decode('utf-8', errors='replace')
        soup = BeautifulSoup(text, 'html.parser')
        
        stores = []
        for tr in soup.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 3:
                store_id = tds[0].get_text(strip=True)
                if re.match(r'^\d{6}$', store_id):
                    stores.append({
                        "id": store_id,
                        "name": tds[1].get_text(strip=True),
                        "address": tds[2].get_text(strip=True)
                    })
        return stores
    except Exception as e:
        print(f"  [Error] Failed to connect to Ibon ({city}): {e}")
        return []

async def main():
    cities = [
        "台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市", 
        "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", 
        "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", 
        "台東縣", "澎湖縣", "金門縣", "連江縣"
    ]
    
    all_stores = []
    print(f"開始從 Ibon 下載全台 7-11 門市清單...")
    
    for city in cities:
        print(f"正在抓取: {city}")
        stores = get_stores_ibon(city)
        print(f"  找到 {len(stores)} 間門市")
        all_stores.extend(stores)
        time.sleep(0.3)
        
    # 儲存結果
    output_path = os.path.join(os.path.dirname(__file__), "stores.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_stores, f, ensure_ascii=False, indent=4)
        
    print(f"\nDownload complete! Total stores: {len(all_stores)}")
    print(f"File saved to: {output_path}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
