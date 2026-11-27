"""Retrieve separate image outputs from the approved OpenAI Image API configuration."""

import base64
import hashlib
import io
import json
import os
import re
import urllib.error
import urllib.request

from PIL import Image, ImageOps

MODELS = {"gpt-image-2", "gpt-image-1.5", "gpt-image-1"}
MAX_RESPONSE = 20 * 1024 * 1024


class VisualProductionError(Exception):
    pass


def atomic_bytes(path, content):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(content)
    temporary.replace(path)


def atomic_json(path, data):
    atomic_bytes(path, (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def request_photo(key, model, prompt):
    request = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps({"model": model, "n": 1, "quality": "high", "output_format": "png",
                         "size": "1152x1440" if model == "gpt-image-2" else "1024x1536",
                         "background": "opaque", "prompt": prompt}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=125) as response:
            receipt = response.headers.get("x-request-id", "")
            raw = response.read(MAX_RESPONSE + 1)
    except urllib.error.HTTPError as error:
        raise VisualProductionError(f"image_provider_http_{error.code}") from None
    except (urllib.error.URLError, TimeoutError):
        raise VisualProductionError("image_provider_connection_failed") from None
    try:
        if len(raw) > MAX_RESPONSE or not re.fullmatch(r"[A-Za-z0-9_-]{8,160}", receipt):
            raise ValueError("unverifiable provider response")
        items = json.loads(raw)["data"]
        if len(items) != 1:
            raise ValueError("expected one original photograph")
        decoded = base64.b64decode(items[0]["b64_json"], validate=True)
        with Image.open(io.BytesIO(decoded)) as received:
            if received.format != "PNG" or received.width < 1024 or received.height < 1350 or received.width * received.height > 8_300_000:
                raise ValueError("unexpected input dimensions")
            exact = ImageOps.fit(received.convert("RGB"), (1080, 1350), method=Image.Resampling.LANCZOS)
            image = io.BytesIO()
            exact.save(image, format="PNG", optimize=True)
        return receipt, image.getvalue()
    except (ValueError, TypeError, OSError, KeyError, IndexError):
        raise VisualProductionError("image_provider_output_invalid") from None


def prepare_sensory_artwork(lesson, folder, generate=request_photo):
    """Per-shot receipts allow retries without reordering work that already succeeded."""
    if os.getenv("HANA_SOCIAL_IMAGE_ENABLED") != "1":
        raise VisualProductionError("image_generation_disabled")
    key = os.getenv("HANA_SOCIAL_IMAGE_API_KEY", "")
    model = os.getenv("HANA_SOCIAL_IMAGE_MODEL", "")
    if not key or model not in MODELS:
        raise VisualProductionError("image_provider_not_configured")
    visual = lesson["visuals"]
    shots = visual["shots"]
    if len(shots) != 7 or [shot["page"] for shot in shots] != list(range(1, 8)):
        raise VisualProductionError("image_shot_list_invalid")
    art = folder / "art"
    art.mkdir(exist_ok=True)
    items = []
    for shot in shots:
        prompt = (
            "Single original full-frame portrait editorial commercial photograph. No grid, panels or collage. "
            "Natural lighting, restrained real film texture, plausible shapes, fine detail. No brand imitation. "
            "No lettering, watermark, logos, perfume or diffuser bottles, candles, citrus, or product placement. "
            "Do not place a face close to the camera. Keep the upper 35 percent calm for later typography. "
            f"Issue topic: {lesson['title']}. Materials: {visual['materials']}. "
            f"Shared palette: {' '.join(visual['palette'])}. Shared lighting and season: {visual['lighting']}. "
            f"This independent shot: {shot['direction']}. {shot['text_clearance']}."
        )
        prompt_hash = hashlib.sha256((model + "\n" + prompt).encode("utf-8")).hexdigest()
        relative = f"art/{shot['page']:02}.png"
        image_path = folder / relative
        receipt_path = image_path.with_suffix(".json")
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            if receipt.get("prompt_hash") != prompt_hash or not image_path.is_file() or hashlib.sha256(image_path.read_bytes()).hexdigest() != receipt.get("sha256"):
                raise VisualProductionError("image_receipt_conflict")
        else:
            if image_path.exists():
                raise VisualProductionError("image_receipt_missing")
            generation_id, png = generate(key, model, prompt)
            receipt = {"file": relative, "page": shot["page"], "generation_id": generation_id,
                       "prompt_hash": prompt_hash, "sha256": hashlib.sha256(png).hexdigest()}
            atomic_bytes(image_path, png)
            atomic_json(receipt_path, receipt)
        items.append(receipt)
    atomic_json(folder / "artwork.json", {
        "format": "hana-social-artwork-v2.1", "date": lesson["date"], "title": lesson["title"], "topic_id": lesson["topic_id"],
        "style": visual["style"], "preset_id": visual["preset_id"], "layout_reference_design_id": visual["layout_reference_design_id"],
        "palette": visual["palette"], "model": model, "origin": "new_original_artwork", "generation_mode": "individual_images", "items": items,
    })
