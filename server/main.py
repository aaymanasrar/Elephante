"""
Elephante ONNX Server — FastAPI backend for fashion AI image generation,
classification, and color extraction. Deployed on Render.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field
from sklearn.cluster import KMeans

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("elephante")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_CACHE_DIR = "/tmp/models"
MOBILENET_URL = (
    "https://github.com/onnx/models/raw/main/validated/vision/classification/"
    "mobilenet/model/mobilenetv2-7.onnx"
)
MOBILENET_PATH = os.path.join(MODEL_CACHE_DIR, "mobilenetv2-7.onnx")

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ---------------------------------------------------------------------------
# ImageNet fashion-relevant class index → {item_type, label}
# Indices sourced from the 1000-class ImageNet synset list.
# ---------------------------------------------------------------------------

IMAGENET_FASHION_MAP: dict[int, dict[str, str]] = {
    # ── tops / shirts ──────────────────────────────────────────────────────
    615: {"item_type": "top", "label": "jersey"},
    906: {"item_type": "top", "label": "sweatshirt"},
    841: {"item_type": "top", "label": "sunglass"},        # broad "wearable"
    # ── bottoms ────────────────────────────────────────────────────────────
    608: {"item_type": "bottom", "label": "jean"},
    # ── dresses / skirts ───────────────────────────────────────────────────
    631: {"item_type": "dress", "label": "gown"},
    910: {"item_type": "dress", "label": "miniskirt"},
    # ── shoes / footwear ───────────────────────────────────────────────────
    514: {"item_type": "shoes", "label": "cowboy boot"},
    770: {"item_type": "shoes", "label": "running shoe"},
    509: {"item_type": "shoes", "label": "clog"},
    738: {"item_type": "shoes", "label": "platform shoe"},
    # ── outerwear ──────────────────────────────────────────────────────────
    834: {"item_type": "outerwear", "label": "suit"},
    787: {"item_type": "outerwear", "label": "trench coat"},
    # ── accessories ────────────────────────────────────────────────────────
    400: {"item_type": "accessory", "label": "accordion"},   # belt-shaped
    439: {"item_type": "accessory", "label": "baseball cap"},
    532: {"item_type": "accessory", "label": "crown"},
    517: {"item_type": "accessory", "label": "crash helmet"},
    806: {"item_type": "accessory", "label": "ski mask"},
    828: {"item_type": "accessory", "label": "sunglasses"},
    # ── bags ───────────────────────────────────────────────────────────────
    414: {"item_type": "bag", "label": "backpack"},
    567: {"item_type": "bag", "label": "purse"},
    765: {"item_type": "bag", "label": "handbag"},
}

# ---------------------------------------------------------------------------
# Color name palette — (R, G, B) → name
# ---------------------------------------------------------------------------

NAMED_COLORS: dict[str, tuple[int, int, int]] = {
    "red":    (220, 38, 38),
    "orange": (234, 88, 12),
    "yellow": (202, 138, 4),
    "green":  (22, 163, 74),
    "blue":   (37, 99, 235),
    "purple": (147, 51, 234),
    "pink":   (236, 72, 153),
    "brown":  (120, 53, 15),
    "black":  (10, 10, 10),
    "white":  (245, 245, 245),
    "grey":   (107, 114, 128),
    "beige":  (245, 222, 179),
    "cream":  (255, 253, 208),
    "navy":   (15, 23, 42),
    "olive":  (85, 107, 47),
    "teal":   (20, 184, 166),
}

# ---------------------------------------------------------------------------
# Global lazy-loaded model cache
# ---------------------------------------------------------------------------

_pipe: Any = None           # diffusers pipeline
_ort_session: Any = None    # onnxruntime InferenceSession
_clip_model: Any = None     # HuggingFace CLIP model
_clip_processor: Any = None # CLIP processor

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)
    steps: int = Field(default=4, ge=1, le=20)
    seed: int | None = None


class GenerateResponse(BaseModel):
    image_b64: str
    provider: str
    width: int
    height: int


class ClassifyRequest(BaseModel):
    image_url: str


class CategoryScore(BaseModel):
    label: str
    score: float


class ClassifyResponse(BaseModel):
    item_type: str
    confidence: float
    categories: list[CategoryScore]


class ColorsRequest(BaseModel):
    image_url: str
    n_colors: int = Field(default=5, ge=1, le=10)


class ColorEntry(BaseModel):
    hex: str
    name: str
    percentage: float


class ColorsResponse(BaseModel):
    colors: list[ColorEntry]


class CompatibilityRequest(BaseModel):
    image_urls: list[str] = Field(min_length=2, max_length=6)
    occasion: str = "casual"


class CompatibilityResponse(BaseModel):
    score: int                  # 0-100
    verdict: str                # short label
    breakdown: dict[str, float] # per-pair scores


class SegmentRequest(BaseModel):
    image_url: str


class SegmentResponse(BaseModel):
    image_b64: str              # PNG with transparent background
    provider: str


class TryOnRequest(BaseModel):
    person_url: str
    garment_url: str
    garment_description: str = ""


class TryOnResponse(BaseModel):
    image_b64: str
    provider: str


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _check_auth(request: Request) -> None:
    """Validates Bearer token against ELEPHANTE_SERVER_KEY env var.
    Skipped entirely when the env var is not set (local dev mode)."""
    secret = os.environ.get("ELEPHANTE_SERVER_KEY")
    if not secret:
        return
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = auth_header.split(" ", 1)[1]
    if token != secret:
        raise HTTPException(status_code=403, detail="Invalid token")


# ---------------------------------------------------------------------------
# Model loaders
# ---------------------------------------------------------------------------

def _load_pipeline() -> Any:
    """Lazily load the SDXL-Turbo diffusers pipeline (cached globally)."""
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch
    from diffusers import StableDiffusionXLPipeline

    log.info("Loading SDXL-Turbo pipeline…")
    t0 = time.time()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    _pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/sdxl-turbo",
        torch_dtype=dtype,
        variant="fp16" if device == "cuda" else None,
        use_safetensors=True,
    ).to(device)

    # Reduce memory footprint where possible
    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()

    log.info("Pipeline loaded in %.1fs on %s", time.time() - t0, device)
    return _pipe


def _load_ort_session() -> Any:
    """Lazily download and load the MobileNetV2 ONNX session (cached globally)."""
    global _ort_session
    if _ort_session is not None:
        return _ort_session

    import onnxruntime as ort

    os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

    if not os.path.exists(MOBILENET_PATH):
        log.info("Downloading MobileNetV2 ONNX model…")
        r = requests.get(MOBILENET_URL, timeout=120, stream=True)
        r.raise_for_status()
        with open(MOBILENET_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        log.info("Model saved to %s", MOBILENET_PATH)

    providers = (
        ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if _cuda_available()
        else ["CPUExecutionProvider"]
    )
    _ort_session = ort.InferenceSession(MOBILENET_PATH, providers=providers)
    log.info("ORT session ready (providers=%s)", providers)
    return _ort_session


def _cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _download_image(url: str, timeout: int = 30) -> Image.Image:
    """Download an image from a URL and return a PIL Image."""
    try:
        resp = requests.get(url, timeout=timeout, stream=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=422, detail=f"Failed to download image: {exc}") from exc
    try:
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot decode image: {exc}") from exc
    return img


def _preprocess_imagenet(img: Image.Image) -> np.ndarray:
    """Resize to 224×224, apply ImageNet normalisation, return NCHW float32 array."""
    img = img.resize((224, 224), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0          # H W C, [0,1]
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD             # normalise
    arr = arr.transpose(2, 0, 1)[np.newaxis, ...]          # NCHW
    return arr.astype(np.float32)


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


def _rgb_to_hex(r: float, g: float, b: float) -> str:
    return "#{:02X}{:02X}{:02X}".format(int(r), int(g), int(b))


def _nearest_color_name(r: float, g: float, b: float) -> str:
    """Return the name of the closest named colour by Euclidean RGB distance."""
    best_name = "grey"
    best_dist = float("inf")
    for name, (nr, ng, nb) in NAMED_COLORS.items():
        dist = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


def _load_clip() -> tuple[Any, Any]:
    """Lazily load CLIP (ViT-B/32) from HuggingFace transformers."""
    global _clip_model, _clip_processor
    if _clip_model is not None:
        return _clip_model, _clip_processor

    from transformers import CLIPModel, CLIPProcessor

    log.info("Loading CLIP ViT-B/32…")
    t0 = time.time()
    _clip_model = CLIPModel.from_pretrained(
        "openai/clip-vit-base-patch32",
        cache_dir=MODEL_CACHE_DIR,
    )
    _clip_processor = CLIPProcessor.from_pretrained(
        "openai/clip-vit-base-patch32",
        cache_dir=MODEL_CACHE_DIR,
    )
    _clip_model.eval()
    log.info("CLIP loaded in %.1fs", time.time() - t0)
    return _clip_model, _clip_processor


def _clip_image_embedding(img: Image.Image) -> "np.ndarray":
    """Return L2-normalised CLIP image embedding (512-dim float32)."""
    import torch

    model, processor = _load_clip()
    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        emb = model.get_image_features(**inputs)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb.numpy()[0]


def _clip_text_embedding(text: str) -> "np.ndarray":
    """Return L2-normalised CLIP text embedding (512-dim float32)."""
    import torch

    model, processor = _load_clip()
    inputs = processor(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        emb = model.get_text_features(**inputs)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb.numpy()[0]


def _cosine(a: "np.ndarray", b: "np.ndarray") -> float:
    return float(np.dot(a, b))


def _make_flatlay(images: list[Image.Image], cell: int = 224) -> Image.Image:
    """Arrange garment images in a 3-wide grid on a white canvas."""
    cols = min(len(images), 3)
    rows = (len(images) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * cell, rows * cell), (255, 255, 255))
    for i, img in enumerate(images):
        img_resized = img.resize((cell, cell), Image.BILINEAR)
        x, y = (i % cols) * cell, (i // cols) * cell
        canvas.paste(img_resized, (x, y))
    return canvas


def _remove_bg(img: Image.Image) -> Image.Image:
    """Remove background using rembg."""
    from rembg import remove as rembg_remove

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    result = rembg_remove(buf.getvalue())
    return Image.open(io.BytesIO(result)).convert("RGBA")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
    log.info("Elephante ONNX server starting — models will load on first request")
    yield
    log.info("Elephante ONNX server shutting down")


app = FastAPI(
    title="Elephante ONNX Server",
    description="Fashion AI — image generation, classification, and color extraction",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "elephante-onnx"}


@app.post("/generate", response_model=GenerateResponse, tags=["generate"])
async def generate_outfit(body: GenerateRequest, request: Request) -> GenerateResponse:
    """
    Text-to-image generation using SDXL-Turbo.
    Returns a base64-encoded PNG.
    """
    _check_auth(request)

    import torch

    try:
        pipe = _load_pipeline()
    except Exception as exc:
        log.exception("Pipeline load failed")
        raise HTTPException(status_code=503, detail=f"Model unavailable: {exc}") from exc

    generator = torch.Generator().manual_seed(body.seed) if body.seed is not None else None

    try:
        with torch.no_grad():
            result = pipe(
                prompt=body.prompt,
                width=body.width,
                height=body.height,
                num_inference_steps=body.steps,
                guidance_scale=0.0,          # SDXL-Turbo uses guidance_scale=0
                generator=generator,
            )
        pil_image: Image.Image = result.images[0]
    except Exception as exc:
        log.exception("Image generation failed")
        raise HTTPException(status_code=500, detail=f"Generation error: {exc}") from exc

    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    provider = "cuda" if _cuda_available() else "cpu"

    return GenerateResponse(
        image_b64=image_b64,
        provider=provider,
        width=pil_image.width,
        height=pil_image.height,
    )


@app.post("/classify", response_model=ClassifyResponse, tags=["classify"])
async def classify_item(body: ClassifyRequest, request: Request) -> ClassifyResponse:
    """
    Fashion item classification using MobileNetV2 (ONNX Runtime).
    Downloads and caches the model on first call.
    """
    _check_auth(request)

    try:
        session = _load_ort_session()
    except Exception as exc:
        log.exception("ORT session load failed")
        raise HTTPException(status_code=503, detail=f"Model unavailable: {exc}") from exc

    img = _download_image(body.image_url, timeout=30)
    inp = _preprocess_imagenet(img)

    input_name = session.get_inputs()[0].name
    try:
        raw_output = session.run(None, {input_name: inp})[0]  # shape: (1, 1000)
    except Exception as exc:
        log.exception("ORT inference failed")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}") from exc

    scores = _softmax(raw_output[0])                          # (1000,)

    # Map top-50 ImageNet classes to fashion categories
    top_indices = scores.argsort()[::-1][:50]
    category_hits: dict[str, float] = {}

    for idx in top_indices:
        idx_int = int(idx)
        if idx_int in IMAGENET_FASHION_MAP:
            entry = IMAGENET_FASHION_MAP[idx_int]
            cat = entry["item_type"]
            category_hits[cat] = category_hits.get(cat, 0.0) + float(scores[idx_int])

    if category_hits:
        best_type = max(category_hits, key=lambda k: category_hits[k])
        best_confidence = category_hits[best_type]
    else:
        # Fallback: pick the top-1 ImageNet class and call it "accessory"
        best_type = "accessory"
        best_confidence = float(scores[top_indices[0]])

    # Build per-category scores for the response
    all_types = ["top", "bottom", "dress", "shoes", "outerwear", "accessory", "bag"]
    categories = [
        CategoryScore(label=t, score=round(category_hits.get(t, 0.0), 4))
        for t in all_types
    ]
    categories.sort(key=lambda c: c.score, reverse=True)

    return ClassifyResponse(
        item_type=best_type,
        confidence=round(best_confidence, 4),
        categories=categories,
    )


@app.post("/colors", response_model=ColorsResponse, tags=["colors"])
async def extract_colors(body: ColorsRequest, request: Request) -> ColorsResponse:
    """
    Dominant color extraction using K-means on a downsampled image.
    No ONNX required — pure PIL + scikit-learn.
    """
    _check_auth(request)

    img = _download_image(body.image_url, timeout=30)

    # Downsample for speed
    img_small = img.resize((150, 150), Image.BILINEAR)
    pixels = np.array(img_small, dtype=np.float32).reshape(-1, 3)  # (22500, 3)

    n = body.n_colors
    try:
        km = KMeans(n_clusters=n, n_init="auto", random_state=42)
        km.fit(pixels)
    except Exception as exc:
        log.exception("KMeans failed")
        raise HTTPException(status_code=500, detail=f"Color extraction error: {exc}") from exc

    labels = km.labels_
    centers = km.cluster_centers_   # (n, 3)
    total_pixels = len(labels)

    # Count pixels per cluster
    counts = np.bincount(labels, minlength=n)

    # Sort by pixel count descending
    order = counts.argsort()[::-1]

    color_entries: list[ColorEntry] = []
    for cluster_idx in order:
        r, g, b = centers[cluster_idx]
        hex_val = _rgb_to_hex(r, g, b)
        name = _nearest_color_name(r, g, b)
        pct = round(float(counts[cluster_idx]) / total_pixels * 100, 2)
        color_entries.append(ColorEntry(hex=hex_val, name=name, percentage=pct))

    return ColorsResponse(colors=color_entries)


@app.post("/compatibility", response_model=CompatibilityResponse, tags=["compatibility"])
async def score_outfit_compatibility(body: CompatibilityRequest, request: Request) -> CompatibilityResponse:
    """
    Score how well a set of garment images work together as an outfit.
    Uses CLIP embeddings + flatlay scoring against style text anchors.
    """
    _check_auth(request)

    # Download all garment images
    images: list[Image.Image] = []
    for url in body.image_urls:
        images.append(_download_image(url, timeout=20))

    try:
        # Get individual embeddings
        embeddings = [_clip_image_embedding(img) for img in images]

        # Score the flatlay against positive style anchors
        flatlay = _make_flatlay(images)
        flatlay_emb = _clip_image_embedding(flatlay)

        occasion_phrase = body.occasion.lower()
        positive_prompts = [
            f"a well-coordinated stylish {occasion_phrase} outfit",
            "fashion-forward color-harmonious clothing ensemble",
            "perfectly matching clothes laid flat",
        ]
        negative_prompts = [
            "mismatched clashing outfit",
            "poorly coordinated clothes",
        ]

        pos_scores = [_cosine(flatlay_emb, _clip_text_embedding(p)) for p in positive_prompts]
        neg_scores = [_cosine(flatlay_emb, _clip_text_embedding(n)) for n in negative_prompts]

        # Aggregate: mean positive minus mean negative, mapped to 0-100
        raw = float(np.mean(pos_scores)) - float(np.mean(neg_scores))
        # raw is typically in [-0.3, 0.3]; scale to [0, 100]
        score = int(min(100, max(0, (raw + 0.3) / 0.6 * 100)))

        # Pairwise cosine similarities for breakdown
        breakdown: dict[str, float] = {}
        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                key = f"item_{i + 1}_vs_{j + 1}"
                breakdown[key] = round(_cosine(embeddings[i], embeddings[j]), 4)

        if score >= 80:
            verdict = "Excellent match"
        elif score >= 60:
            verdict = "Good pairing"
        elif score >= 40:
            verdict = "Decent combo"
        else:
            verdict = "Consider alternatives"

        return CompatibilityResponse(score=score, verdict=verdict, breakdown=breakdown)

    except Exception as exc:
        log.exception("Compatibility scoring failed")
        raise HTTPException(status_code=500, detail=f"Compatibility error: {exc}") from exc


@app.post("/segment", response_model=SegmentResponse, tags=["segment"])
async def segment_garment(body: SegmentRequest, request: Request) -> SegmentResponse:
    """
    Remove the background from a garment image using rembg (U2Net).
    Returns a base64-encoded RGBA PNG with transparent background.
    """
    _check_auth(request)

    img = _download_image(body.image_url, timeout=30)

    try:
        result = _remove_bg(img)
    except Exception as exc:
        log.exception("Background removal failed")
        raise HTTPException(status_code=500, detail=f"Segmentation error: {exc}") from exc

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return SegmentResponse(image_b64=image_b64, provider="rembg-u2net")


@app.post("/tryon", response_model=TryOnResponse, tags=["tryon"])
async def virtual_tryon(body: TryOnRequest, request: Request) -> TryOnResponse:
    """
    Virtual try-on: dress a person image in a garment.
    Proxies to IDM-VTON via Nymbo HuggingFace Space API.
    Falls back to a simple overlay composite if the space is unavailable.
    """
    _check_auth(request)

    HF_SPACE_API = "https://nymbo-virtual-try-on.hf.space"

    try:
        # Step 1: upload person image to HF space
        person_resp = requests.get(body.person_url, timeout=20)
        person_resp.raise_for_status()
        garment_resp = requests.get(body.garment_url, timeout=20)
        garment_resp.raise_for_status()

        upload_person = requests.post(
            f"{HF_SPACE_API}/upload",
            files={"files": ("person.jpg", person_resp.content, "image/jpeg")},
            timeout=30,
        )
        upload_garment = requests.post(
            f"{HF_SPACE_API}/upload",
            files={"files": ("garment.jpg", garment_resp.content, "image/jpeg")},
            timeout=30,
        )

        if upload_person.status_code != 200 or upload_garment.status_code != 200:
            raise ValueError("HF space upload failed")

        person_file = upload_person.json()[0]
        garment_file = upload_garment.json()[0]

        # Step 2: run prediction
        predict_resp = requests.post(
            f"{HF_SPACE_API}/run/predict",
            json={
                "data": [
                    {"path": person_file},
                    {"path": garment_file},
                    body.garment_description or "clothing item",
                    True,   # is_checked
                    True,   # is_checked_crop
                    30,     # denoise steps
                    42,     # seed
                ]
            },
            timeout=120,
        )
        predict_resp.raise_for_status()
        result_data = predict_resp.json()

        # Extract result image URL from response
        result_path = result_data["data"][0].get("url") or result_data["data"][0].get("path", "")
        if result_path:
            result_img_resp = requests.get(
                result_path if result_path.startswith("http") else f"{HF_SPACE_API}/file={result_path}",
                timeout=30,
            )
            result_img_resp.raise_for_status()
            image_b64 = base64.b64encode(result_img_resp.content).decode("utf-8")
            return TryOnResponse(image_b64=image_b64, provider="idm-vton")

        raise ValueError("No result image in response")

    except Exception as exc:
        log.warning("IDM-VTON failed (%s), falling back to overlay composite", exc)

        # Fallback: simple person + garment side-by-side composite
        try:
            person_img = _download_image(body.person_url, timeout=20)
            garment_img = _download_image(body.garment_url, timeout=20)

            w, h = 512, 640
            person_resized = person_img.resize((w // 2, h), Image.BILINEAR)
            garment_resized = garment_img.resize((w // 2, h), Image.BILINEAR)

            composite = Image.new("RGB", (w, h), (248, 248, 248))
            composite.paste(person_resized, (0, 0))
            composite.paste(garment_resized, (w // 2, 0))

            # Draw divider
            draw = ImageDraw.Draw(composite)
            draw.line([(w // 2, 0), (w // 2, h)], fill=(220, 220, 220), width=2)

            buf = io.BytesIO()
            composite.save(buf, format="JPEG", quality=88)
            image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            return TryOnResponse(image_b64=image_b64, provider="composite-fallback")
        except Exception as fallback_exc:
            raise HTTPException(status_code=503, detail=f"Try-on unavailable: {fallback_exc}") from fallback_exc


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


# ---------------------------------------------------------------------------
# Entry point (local dev)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
