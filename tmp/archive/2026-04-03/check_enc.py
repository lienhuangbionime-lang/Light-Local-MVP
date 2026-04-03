import json
import os

path = r"scripts/stores.json"
try:
    with open(path, "rb") as f:
        data = f.read(1024)
    print(f"First 1024 bytes: {data}")
    
    # Try decoding
    print("\nUTF-8 Try:")
    try:
        print(data.decode("utf-8")[:100])
    except Exception as e:
        print(f"UTF-8 Fail: {e}")
        
    print("\nBig5 Try:")
    try:
        print(data.decode("big5")[:100])
    except Exception as e:
        print(f"Big5 Fail: {e}")
        
except Exception as e:
    print(f"Error: {e}")
