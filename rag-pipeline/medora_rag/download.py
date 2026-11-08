import hashlib
import json
import os
import ssl
import sys
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional


def compute_sha256(file_path: Path) -> str:
    """Compute the SHA-256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_ssl_context() -> ssl.SSLContext:
    """Create an SSL context compatible with MOH Malaysia servers."""
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
    # Some Malaysian gov portals use internal root CAs; allow fallback if needed
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def download_file(url: str, dest_path: Path, expected_sha256: Optional[str] = None) -> bool:
    """Download a file with verification and temporary file handling."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(".tmp")
    
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    }
    req = urllib.request.Request(url, headers=headers)
    ctx = get_ssl_context()

    print(f"  Downloading: {url}")
    with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Failed to download {url}: HTTP {resp.status}")
        with open(temp_path, "wb") as f:
            while chunk := resp.read(65536):
                f.write(chunk)

    computed_hash = compute_sha256(temp_path)
    if expected_sha256 and computed_hash.lower() != expected_sha256.lower():
        if temp_path.exists():
            temp_path.unlink()
        raise ValueError(
            f"SHA-256 mismatch for {dest_path.name}!\n"
            f"  Expected: {expected_sha256}\n"
            f"  Actual:   {computed_hash}"
        )

    # Move temp file to final destination
    if dest_path.exists():
        dest_path.unlink()
    temp_path.rename(dest_path)
    print(f"  Saved: {dest_path} (SHA-256: {computed_hash})")
    return True


def download_all_cpgs(manifest_path: Optional[Path] = None, output_dir: Optional[Path] = None) -> Dict[str, str]:
    """
    Download all guidelines listed in manifest.json.
    Skips files that already exist and match expected SHA-256 checksums.
    """
    base_dir = Path(__file__).resolve().parent.parent
    if manifest_path is None:
        manifest_path = base_dir / "data" / "manifest.json"
    if output_dir is None:
        output_dir = base_dir / "data" / "raw"

    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found at {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest: List[Dict] = json.load(f)

    results: Dict[str, str] = {}
    print(f"Processing {len(manifest)} guidelines from {manifest_path.name}...")

    for item in manifest:
        doc_id = item["doc_id"]
        title = item["title"]
        url = item["source_url"]
        expected_sha = item.get("sha256", "")
        dest_file = output_dir / f"{doc_id}.pdf"

        print(f"\n[{doc_id}] {title}")
        if dest_file.exists():
            current_hash = compute_sha256(dest_file)
            if expected_sha and current_hash.lower() == expected_sha.lower():
                print(f"  [SKIP] Already exists and checksum matches ({dest_file.name})")
                results[doc_id] = "skipped"
                continue
            else:
                print(f"  [RE-DOWNLOAD] Existing file hash mismatch. Re-downloading...")

        download_file(url, dest_file, expected_sha)
        results[doc_id] = "downloaded"

    print("\nAll downloads processed successfully.")
    return results


if __name__ == "__main__":
    download_all_cpgs()
