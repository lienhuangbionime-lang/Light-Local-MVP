import asyncio
import os
import sys

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.database.firebase import init_firebase, db
import backend.config as config

async def check():
    init_firebase()
    if not db:
        print("Firebase not initialized")
        return
    
    print("Fetching one sample from stores_711...")
    docs = db.collection("stores_711").limit(1).stream()
    for doc in docs:
        print(f"ID: {doc.id}")
        print(f"Data: {doc.to_dict()}")

if __name__ == "__main__":
    asyncio.run(check())
