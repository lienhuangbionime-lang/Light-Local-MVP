import os
import google.generativeai as genai
from dotenv import load_dotenv
import PIL.Image

load_dotenv()

def test_a4b_vision():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    genai.configure(api_key=api_key)
    model_name = "models/gemma-4-26b-a4b-it"
    
    print(f"--- Testing Model: {model_name} ---")
    
    try:
        model = genai.GenerativeModel(model_name)
        
        # Load the screenshot we took earlier
        img_path = "screenshot.jpg"
        if not os.path.exists(img_path):
            print(f"Error: {img_path} not found. Capturing a new one...")
            return

        img = PIL.Image.open(img_path)
        
        # Try sending an image
        print("Sending image prompt...")
        response = model.generate_content(["Describe this image in detail.", img])
        
        print("\n[SUCCESS] Model responded to image:")
        print(response.text)
        
    except Exception as e:
        print(f"\n[FAILED] Model does not seem to support image input.")
        print(f"Error Details: {str(e)}")

if __name__ == "__main__":
    test_a4b_vision()
