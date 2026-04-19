"""
売約済み物件の画像アーカイブモジュール

売約検出時に物件写真をDL → WebP 400px圧縮 → Supabase Storageにアップロード
- cdn.e-uchina.net の画像のみ（YouTube等の案内画像を除外）
- 1物件あたり最大3枚（先頭・中間・末尾）
- WebP 400px で約1.5KB/枚 → 月13.5MB → 1GBで6年持つ
"""

import os
import io
import json
import hashlib
import requests
from PIL import Image
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

# NextCodeプロジェクトのStorageを使用（.envから読み込み）
SUPABASE_URL = os.getenv("STORAGE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("STORAGE_SUPABASE_KEY")
STORAGE_BUCKET = "sold-property-images"
WEBP_MAX_SIZE = 400  # px (long side)
WEBP_QUALITY = 60
MAX_IMAGES_PER_PROPERTY = 3


def _filter_property_images(image_urls: List[str]) -> List[str]:
    """cdn.e-uchina.net の物件写真だけを抽出（YouTube等を除外）"""
    return [url for url in image_urls if "cdn.e-uchina.net" in url]


def _pick_representative_images(urls: List[str], max_count: int = MAX_IMAGES_PER_PROPERTY) -> List[str]:
    """代表画像を選択: 先頭・中間・末尾"""
    if not urls:
        return []
    if len(urls) <= max_count:
        return urls

    indices = [0, len(urls) // 2, len(urls) - 1]
    seen = set()
    result = []
    for i in indices:
        if i not in seen:
            seen.add(i)
            result.append(urls[i])
    return result[:max_count]


def _download_and_compress(url: str) -> Optional[bytes]:
    """画像をDLしてWebP 400pxに圧縮"""
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()

        img = Image.open(io.BytesIO(resp.content))

        # RGBA → RGB (WebP with transparency is larger)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Resize (long side to WEBP_MAX_SIZE, keep aspect ratio)
        w, h = img.size
        if max(w, h) > WEBP_MAX_SIZE:
            ratio = WEBP_MAX_SIZE / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        # Compress to WebP
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=WEBP_QUALITY)
        return buf.getvalue()
    except Exception as e:
        print(f"  Image download/compress failed: {url} - {e}")
        return None


def _upload_to_supabase(data: bytes, path: str) -> Optional[str]:
    """Supabase Storageにアップロード（既存ファイルは上書き）"""
    try:
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "image/webp",
            "x-upsert": "true",
        }
        resp = requests.post(upload_url, headers=headers, data=data, timeout=15)

        if resp.status_code in (200, 201):
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
            return public_url
        else:
            print(f"  Upload failed ({resp.status_code}): {resp.text[:100]}")
            return None
    except Exception as e:
        print(f"  Upload error: {e}")
        return None


def archive_sold_property_images(url: str, images_json: str, category: str) -> List[str]:
    """
    売約済み物件の画像をアーカイブ

    Args:
        url: 物件URL
        images_json: JSON配列文字列 or list の画像URL
        category: カテゴリ名

    Returns:
        アーカイブされた画像のパブリックURL一覧
    """
    # Parse images
    if isinstance(images_json, str):
        try:
            image_urls = json.loads(images_json)
        except:
            return []
    elif isinstance(images_json, list):
        image_urls = images_json
    else:
        return []

    if not image_urls:
        return []

    # Filter & pick
    property_images = _filter_property_images(image_urls)
    selected = _pick_representative_images(property_images)

    if not selected:
        return []

    # Generate storage path from property URL
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    today = datetime.now().strftime("%Y%m%d")

    archived_urls = []
    for i, img_url in enumerate(selected):
        data = _download_and_compress(img_url)
        if data is None:
            continue

        path = f"{category}/{today}/{url_hash}_{i}.webp"
        public_url = _upload_to_supabase(data, path)

        if public_url:
            archived_urls.append(public_url)

    return archived_urls


def ensure_bucket_exists():
    """Supabase Storageにバケットが存在することを確認、なければ作成"""
    try:
        # Check if bucket exists
        check_url = f"{SUPABASE_URL}/storage/v1/bucket/{STORAGE_BUCKET}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
        resp = requests.get(check_url, headers=headers, timeout=10)

        if resp.status_code == 200:
            print(f"Storage bucket '{STORAGE_BUCKET}' exists.")
            return True

        # Create bucket
        create_url = f"{SUPABASE_URL}/storage/v1/bucket"
        payload = {
            "id": STORAGE_BUCKET,
            "name": STORAGE_BUCKET,
            "public": True,
        }
        resp = requests.post(create_url, headers=headers, json=payload, timeout=10)

        if resp.status_code in (200, 201):
            print(f"Created storage bucket '{STORAGE_BUCKET}'.")
            return True
        else:
            print(f"Failed to create bucket ({resp.status_code}): {resp.text[:100]}")
            return False
    except Exception as e:
        print(f"Bucket check/create error: {e}")
        return False
