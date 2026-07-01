import os
import io
import json
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from PIL import Image
import torch
import requests

# FREE OPEN SOURCE ALTERNATIVES
from rembg import remove, new_session
from transformers import AutoModelForCausalLM, AutoTokenizer
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client

app = FastAPI(title="Elephante Free Local AI Engine", version="1.0.0")

# 1. INITIALIZE FREE LOCAL MODELS (Downloaded automatically on first run)
print("Loading free local AI models... Please wait.")
device = "cuda" if torch.cuda.is_available() else "cpu"

# Free Multilingual Text Search Embeddings (Handles Arabic & English)
embedding_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', device=device)

# Free Lightweight Vision Model for Tagging (Fits on tiny laptops/servers)
vision_model_id = "vikhyatk/moondream2"
vision_revision = "2024-04-02"
vision_model = AutoModelForCausalLM.from_pretrained(vision_model_id, revision=vision_revision, trust_remote_code=True).to(device)
vision_tokenizer = AutoTokenizer.from_pretrained(vision_model_id, revision=vision_revision)

# Free Background Isolation Session
rembg_session = new_session("u2net")

# Free Supabase connection (Stays on their permanent free tier)
SUPABASE_URL = os.getenv("SUPABASE_URL", "YOUR_FREE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "YOUR_FREE_SUPABASE_KEY")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class SearchQuery(BaseModel):
    user_id: str
    text_prompt: str


# 2. FREE API ENDPOINTS

@app.post("/api/v2/wardrobe/upload")
async def free_upload_and_ingest(user_id: str = Form(...), file: UploadFile = File(...)):
    raw_file_data = await file.read()
    
    # STEP 1: FREE BACKGROUND REMOVAL (Local CPU/GPU execution)
    input_image = Image.open(io.BytesIO(raw_file_data))
    clean_image = remove(input_image, session=rembg_session)
    
    output_buffer = io.BytesIO()
    clean_image.save(output_buffer, format="PNG")
    clean_png_bytes = output_buffer.getvalue()

    # STEP 2: FREE LOCAL AI TAGGING (Moondream Vision Model)
    # Open-source models struggle with strict JSON schemas, so we parse explicit text questions
    tag_prompt = "Identify the Khaleeji garment category (Abaya, Thobe, Sheila, Bisht, or Kaftan), describe the cut, and name the dominant color."
    enc_image = vision_model.encode_image(clean_image.convert("RGB"))
    ai_description = vision_model.answer_question(enc_image, tag_prompt, vision_tokenizer)
    
    # STEP 3: FREE LOCAL MULTILINGUAL VECTOR EMBEDDING
    # Converts description into a 384-dimension search vector natively
    local_embedding = embedding_model.encode(ai_description).tolist()

    # STEP 4: SAVE TO CLOUD (Supabase Free Storage Bucket)
    storage_path = f"wardrobes/{user_id}/{file.filename.split('.')[0]}_free.png"
    supabase_client.storage.from_("apparel").upload(
        path=storage_path,
        file=io.BytesIO(clean_png_bytes),
        file_options={"content-type": "image/png"}
    )
    public_url = supabase_client.storage.from_("apparel").get_public_url(storage_path)

    # Save metadata row
    db_record = {
        "user_id": user_id,
        "image_url": public_url,
        "category": "Detected Local Asset",
        "sub_type": ai_description, # Stores the local AI text summary directly
        "embedding": local_embedding # Fits perfectly into your pgvector database
    }
    response = supabase_client.table("wardrobe_items").insert(db_record).execute()

    return {
        "status": "success",
        "ai_analysis": ai_description,
        "data": response.data
    }


@app.post("/api/v2/wardrobe/search")
async def free_bilingual_search(query: SearchQuery):
    """
    FREE SEARCH: Turns English/Arabic/Arabizi text into vector matches instantly on your device.
    """
    # Vectorize incoming query text using local Huggingface pipeline
    query_embedding = embedding_model.encode(query.text_prompt).tolist()
    
    rpc_response = supabase_client.rpc(
        "match_wardrobe_items",
        {
            "query_embedding": query_embedding,
            "match_threshold": 0.25,
            "match_count": 10,
            "filter_user_id": query.user_id
        }
    ).execute()
    
    return {"status": "success", "results": rpc_response.data}


def execute_local_comfyui_tryon(user_id: str, garment_url: str):
    try:
        user_profile = supabase_client.table("profiles").select("avatar_url").eq("id", user_id).single().execute()
        user_avatar = user_profile.data.get("avatar_url", "https://elephante.app/default_avatar.png")
        
        # Sends request to Local ComfyUI running IDM-VTON
        comfyui_endpoint = "http://127.0.0.1:8188/prompt"
        
        # Placeholder ComfyUI JSON payload
        # Note: You need to replace this with your actual exported API format from ComfyUI
        payload = {
            "prompt": {
                "3": {
                    "class_type": "IDM-VTON",
                    "inputs": {
                        "human_image": user_avatar,
                        "garment_image": garment_url,
                        "category": "dress",
                        "crop": True
                    }
                }
            }
        }
        requests.post(comfyui_endpoint, json=payload)
    except Exception as e:
        print(f"Local ComfyUI Try-On Worker Interrupted: {str(e)}")


@app.post("/api/v2/wardrobe/tryon")
async def generate_virtual_tryon(user_id: str, garment_id: str, background_tasks: BackgroundTasks):
    """
    TRIGGERS LOCAL COMFYUI VTON IN BACKGROUND
    """
    item = supabase_client.table("wardrobe_items").select("*").eq("id", garment_id).single().execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="Garment matrix artifact missing.")
    
    background_tasks.add_task(
        execute_local_comfyui_tryon, 
        user_id, 
        item.data.get("image_url")
    )
    return {"status": "processing", "message": "Try-on simulation queued to local ComfyUI GPU workers."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
