import yt_dlp
import os
import re
import uuid
import asyncio
from pathlib import Path
from typing import Optional

DOWNLOAD_DIR = Path("/tmp/skoros_downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

COOKIES_FILE = Path(__file__).parent / "cookies.txt"

SUPPORTED_DOMAINS = {
    "tiktok.com": "TikTok",
    "vm.tiktok.com": "TikTok",
    "vt.tiktok.com": "TikTok",
    "instagram.com": "Instagram",
    "instagr.am": "Instagram",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "m.youtube.com": "YouTube",
    "facebook.com": "Facebook",
    "fb.com": "Facebook",
    "fb.watch": "Facebook",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "t.co": "Twitter/X",
}


def detect_platform(url: str) -> Optional[str]:
    url = url.lower().strip()
    for domain, name in SUPPORTED_DOMAINS.items():
        if domain in url:
            return name
    return None


def clean_url(url: str) -> str:
    """Strip tracking params that break extractors (e.g. Facebook mibextid)."""
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    try:
        parsed = urlparse(url)
        junk = {'mibextid', 'igsh', 'igshid', 'fbclid', 'utm_source', 'utm_medium',
                'utm_campaign', 'utm_content', 'utm_term', 's', 'ref',
                'list', 'start_radio', 'index', 'pp', 'si'}
        qs = {k: v for k, v in parse_qs(parsed.query).items() if k.lower() not in junk}
        clean = parsed._replace(query=urlencode(qs, doseq=True))
        return urlunparse(clean)
    except Exception:
        return url


def _cookie_opt() -> Optional[str]:
    """Return cookies.txt path if it exists, else None."""
    return str(COOKIES_FILE) if COOKIES_FILE.exists() else None


def _base_headers() -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
    }


def get_ydl_opts(output_path: str, quality: str = "best") -> dict:
    format_selector = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
    if quality == "medium":
        format_selector = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]"
    elif quality == "low":
        format_selector = "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/worst"

    opts = {
        "format": format_selector,
        "outtmpl": output_path,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "merge_output_format": "mp4",
        "postprocessors": [{
            "key": "FFmpegVideoConvertor",
            "preferedformat": "mp4",
        }],
        "http_headers": _base_headers(),
        "extractor_retries": 3,
        "socket_timeout": 15,
        "extractor_args": {"youtube": {"player_client": ["android", "tv_embedded", "web"]}},
    }
    cookie = _cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie
    return opts


def get_image_opts(output_path: str) -> dict:
    opts = {
        "outtmpl": output_path,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "writethumbnail": True,
        "skip_download": True,
        "http_headers": _base_headers(),
        "extractor_retries": 3,
        "socket_timeout": 15,
        "extractor_args": {"youtube": {"player_client": ["android", "tv_embedded", "web"]}},
    }
    cookie = _cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie
    return opts


def get_audio_opts(output_path: str) -> dict:
    opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "http_headers": _base_headers(),
        "extractor_retries": 3,
        "socket_timeout": 15,
        "extractor_args": {"youtube": {"player_client": ["android", "tv_embedded", "web"]}},
    }
    cookie = _cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie
    return opts


async def get_media_info(url: str) -> dict:
    url = clean_url(url)

    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "http_headers": _base_headers(),
        "extractor_retries": 5,
        "socket_timeout": 15,
        "ignoreerrors": False,
        "extractor_args": {"youtube": {"player_client": ["android", "tv_embedded", "web"]}},
    }
    cookie = _cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie

    def _extract():
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                raise ValueError("Could not extract media info from this URL.")

            formats = []
            raw_formats = info.get("formats") or []
            if raw_formats:
                seen = set()
                for f in raw_formats:
                    height = f.get("height")
                    ext = f.get("ext", "mp4")
                    vcodec = f.get("vcodec", "")
                    if vcodec == "none":
                        continue
                    if height and height not in seen:
                        seen.add(height)
                        formats.append({
                            "format_id": f.get("format_id"),
                            "height": height,
                            "ext": ext,
                            "label": f"{height}p",
                        })
                formats.sort(key=lambda x: x["height"], reverse=True)

            is_image = (
                info.get("_type") == "photo"
                or info.get("ext") in ("jpg", "jpeg", "png", "gif", "webp")
                or (not raw_formats and not info.get("url", "").endswith(".mp4"))
            )

            return {
                "title": info.get("title", "Unknown"),
                "platform": detect_platform(url) or info.get("extractor_key", "Unknown"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration"),
                "uploader": info.get("uploader") or info.get("channel"),
                "formats": formats[:5],
                "is_image": is_image,
            }

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _extract)


async def download_media(url: str, quality: str = "best", media_type: str = "video") -> dict:
    job_id = str(uuid.uuid4())[:8]
    output_template = str(DOWNLOAD_DIR / f"{job_id}.%(ext)s")

    url = clean_url(url)

    def _download():
        if media_type == "image":
            opts = get_image_opts(output_template)
        elif media_type == "audio":
            opts = get_audio_opts(output_template)
        else:
            opts = get_ydl_opts(output_template, quality)

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "download")

            downloaded = list(DOWNLOAD_DIR.glob(f"{job_id}.*"))
            if not downloaded:
                raise FileNotFoundError("Download completed but file not found")

            file_path = str(downloaded[0])
            actual_ext = downloaded[0].suffix.lstrip(".")

            return {
                "file_path": file_path,
                "filename": build_filename(title, detect_platform(url), quality, media_type, actual_ext),
                "title": title,
                "platform": detect_platform(url),
                "ext": actual_ext,
            }

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _download)


def sanitize_filename(name: str) -> str:
    name = name.encode('ascii', 'ignore').decode('ascii')
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_. ')
    return name[:80] if len(name) > 80 else name or "download"


def build_filename(title: str, platform: str, quality: str, media_type: str, ext: str) -> str:
    slug_title = sanitize_filename(title)
    if media_type == "audio":
        quality_tag = "audio"
    elif media_type == "image":
        quality_tag = "image"
    else:
        quality_tag = quality
    return f"{slug_title}_{quality_tag}.{ext}"


def cleanup_file(file_path: str):
    try:
        os.remove(file_path)
    except Exception:
        pass
