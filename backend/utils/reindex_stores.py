import asyncio
import os
import sys

# Add project root (parent of 'backend') to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.firebase import db
from backend.services.ai_service import get_gemini_embedding
from google.cloud.firestore_v1.vector import Vector

async def reindex_stores():
    """將 stores_711 中的所有門市重新生成向量"""
    if not db:
        print("[REINDEX] Firebase 未初始化")
        return

    print("[REINDEX] 開始重新編製門市索引...")
    
    # 取得集合
    collection = db.collection("stores_711")
    docs = list(collection.stream())
    total = len(docs)
    
    print(f"[REINDEX] 找到 {total} 筆門市資料")
    
    for i, doc in enumerate(docs):
        data = doc.to_dict()
        name = data.get("name")
        
        if not name:
            continue
            
        print(f"[{i+1}/{total}] 正在處理: {name}")
        
        # 取得新向量
        vector_values = await get_gemini_embedding(name)
        
        if vector_values:
            # 更新文件
            doc.reference.update({
                "name_vector": Vector(vector_values)
            })
        else:
            print(f"  ⚠️ 無法取得 '{name}' 的向量")
            
        # 避免 API 頻率限制
        await asyncio.sleep(0.5)

    print("[REINDEX] 索引編製完成！")

if __name__ == "__main__":
    asyncio.run(reindex_stores())
