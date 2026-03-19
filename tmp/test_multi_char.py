import requests
import json

def test_multi_char_code():
    url = "https://light-local-mvp.onrender.com/api/debug/simulate_webhook"
    
    # 用 AA 測試，數量 3
    payload = {
        "code": "AA",
        "quantity": 3,
        "sender_id": "u_test_aa",
        "sender_name": "Test AA User"
    }
    
    print(f"Simulating webhook for product code '{payload['code']}'...")
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_multi_char_code()
