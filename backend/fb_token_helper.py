import requests
import sys
import os

def get_long_lived_token(app_id, app_secret, short_token):
    # 第一步：檢查 Token 身分與類型
    print(f"\n[*] Checking token identity...")
    debug_url = f"https://graph.facebook.com/v25.0/me?fields=id,name,category&access_token={short_token}"
    res_me = requests.get(debug_url)
    if res_me.status_code != 200:
        print(f"❌ Error checking token: {res_me.text}")
        return None
    
    identity = res_me.json()
    name = identity.get('name')
    is_page = 'category' in identity
    
    print(f"✅ Token represents: {name} ({'Page' if is_page else 'User'})")

    # 第二步：交換長效 Token
    print(f"\n[1/2] Exchanging for Long-lived version...")
    url = "https://graph.facebook.com/v25.0/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token
    }
    
    res = requests.get(url, params=params)
    if res.status_code != 200:
        print(f"❌ Exchange Failed: {res.text}")
        return None
    
    exchanged_token = res.json().get("access_token")
    
    if is_page:
        print(f"✅ Success! Since you provided a PAGE token, the exchanged token is now long-lived.")
        print(f"\n🚀 FINAL LONG-LIVED TOKEN for {name}:")
        print("-" * 50)
        print(exchanged_token)
        print("-" * 50)
        print("\nPaste this into Render Environment Variables as PAGE_ACCESS_TOKEN.")
        return

    print("✅ Success! Got long-lived USER Token.")

    # 第三步：獲取粉專 Token (僅限 User Token 才能執行此步)
    print(f"\n[2/2] Fetching Page Access Tokens from your User account...")
    page_url = f"https://graph.facebook.com/v25.0/me/accounts"
    res_page = requests.get(page_url, params={"access_token": exchanged_token})
    
    if res_page.status_code != 200:
        print(f"❌ Error fetching accounts: {res_page.text}")
        return None
    
    pages_data = res_page.json().get("data", [])
    if not pages_data:
        print("Error: No pages found. Make sure the token has 'pages_show_list' and 'pages_read_engagement' permissions.")
        return None

    print("\n--- Available Pages ---")
    for i, page in enumerate(pages_data):
        print(f"[{i}] {page.get('name')} (ID: {page.get('id')})")
    
    choice = input("\nSelect page index to get token: ")
    try:
        selected_page = pages_data[int(choice)]
        page_token = selected_page.get("access_token")
        page_name = selected_page.get("name")
        print(f"\n🚀 FINAL LONG-LIVED TOKEN for {page_name}:")
        print("-" * 50)
        print(page_token)
        print("-" * 50)
        print("\nKeep this token safe! Paste it into Render Environment Variables as PAGE_ACCESS_TOKEN.")
    except Exception as e:
        print(f"Invalid selection: {e}")

if __name__ == "__main__":
    print("=== Facebook Long-Lived Token Helper ===")
    app_id = input("Enter FB App ID: ").strip()
    app_secret = input("Enter FB App Secret: ").strip()
    short_token = input("Enter Short-lived User Token (from Graph Explorer): ").strip()

    if not all([app_id, app_secret, short_token]):
        print("Error: All inputs are required.")
        sys.exit(1)

    get_long_lived_token(app_id, app_secret, short_token)
