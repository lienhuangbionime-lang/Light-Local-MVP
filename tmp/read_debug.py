import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import sys

# Path fix
sys.path.insert(0, os.path.abspath("."))

def read_debug_events():
    key_paths = ["backend/serviceAccountKey.json", "serviceAccountKey.json"]
    target_path = next((p for p in key_paths if os.path.exists(p)), None)
    if not target_path:
        print("Key not found")
        return
    
    cred = credentials.Certificate(target_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    doc = db.collection("system").document("debug_events").get()
    
    if doc.exists:
        data = doc.to_dict()
        events = data.get("events", [])
        print(f"Found {len(events)} events.")
        # Filter for recent debug events
        debug_events = [e for e in events if e.get("time") == "debug"]
        if debug_events:
            print("Recent Debug Events:")
            for e in debug_events[:5]:
                 print(f"[{e.get('time')}] {e.get('content')}")
        else:
            print("No debug events found yet.")
            # Print last 5 general events
            print("\nLast 5 events:")
            for e in events[:5]:
                print(f"- {e.get('content')}")
    else:
        print("debug_events NOT found")

if __name__ == "__main__":
    if sys.stdout.encoding != 'utf-8':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    read_debug_events()
