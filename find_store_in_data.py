import json
import os

def find_store():
    paths = ["scripts/stores_cloud.json", "scripts/stores.json"]
    for p in paths:
        if os.path.exists(p):
            print(f"Searching in {p}...")
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            count = 0
            if isinstance(data, dict):
                for sid, s in data.items():
                    name = s.get("name", "")
                    if "旗山" in name or "旗力" in name:
                        print(f"Found ID: {sid}, Name: {name}, Address: {s.get('address')}")
                        count += 1
            elif isinstance(data, list):
                for s in data:
                    name = s.get("name", "")
                    if "旗山" in name or "旗力" in name:
                        print(f"Found ID: {s.get('id')}, Name: {name}, Address: {s.get('address')}")
                        count += 1
            print(f"Total found: {count}")

if __name__ == "__main__":
    find_store()
