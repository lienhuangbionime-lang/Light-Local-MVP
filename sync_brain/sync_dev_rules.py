import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Bootstrapper for Developer AI Rules - Synchronizes AI Coding Guidelines across any project

def main():
    print("🚀 Initiating Meta-Dev Core Link (Supabase Developer Rules Sync)...")
    
    # 1. Load basic environment
    if not os.getenv("SUPABASE_URL"):
        if not os.path.exists(".env"):
            print("❌ CRITICAL: `.env` not found. The AI cannot synchronize the Commander's architectural rules.")
            print("Please provide an `.env` with SUPABASE_URL and SUPABASE_KEY.")
            sys.exit(1)
        load_dotenv()
        
    url: str = os.getenv("SUPABASE_URL")
    key: str = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("❌ CRITICAL: Supabase credentials missing from .env.")
        sys.exit(1)
        
    try:
        supabase: Client = create_client(url, key)
        
        # 2. Extract rules from the Cloud Database
        print("🌍 Fetching `developer_rules` from the Cloud Memory...")
        
        try:
            res = supabase.table("developer_rules").select("*").execute()
            data = res.data
        except Exception as e:
            print(f"⚠️ Could not fetch `developer_rules` table: {e}")
            print("To fix this, create a Supabase table named 'developer_rules' with columns:")
            print("- id (uuid)")
            print("- category (text) e.g. 'rules' or 'system_context'")
            print("- content (text) The actual Markdown rule text")
            sys.exit(1)
            
        if not data:
            print("⚠️ Table `developer_rules` is empty right now.")
            sys.exit(0)
            
        # 3. Compile local rules files dynamically
        cursor_rules = ["# Dynamic AI Developer Rules (Synced from Cloud)\n"]
        system_context = ["# Dynamic Agentic Context (Synced from Cloud)\n"]
        
        for rule in data:
            if rule.get("category") == "cursorrules":
                cursor_rules.append(rule.get("content"))
            else:
                system_context.append(rule.get("content"))
                
        # 4. Inject
        with open(".cursorrules", "w", encoding="utf-8") as f:
            f.write("\n\n".join(cursor_rules))
            
        # Ensure sync_brain exists if needed
        if not os.path.exists("sync_brain"):
            os.makedirs("sync_brain")
            
        with open("sync_brain/SYSTEM_CONTEXT.md", "w", encoding="utf-8") as f:
            f.write("\n\n".join(system_context))
            
        print("✅ SUCCESS: AI Developer Mind has been updated with the Commander's latest Cloud Rules.")
        
    except Exception as e:
        print(f"❌ Unknown Sync Error: {e}")

if __name__ == "__main__":
    main()
