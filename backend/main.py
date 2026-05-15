from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional
import os
import asyncio

from downloader import (
    get_media_info,
    download_media,
    detect_platform,
    cleanup_file,
    SUPPORTED_DOMAINS,
)

app = FastAPI(title="Skoros API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    quality: Optional[str] = "best"
    media_type: Optional[str] = "video"


@app.get("/health")
def health():
    return {"status": "ok", "service": "Skoros"}


@app.get("/platforms")
def platforms():
    unique = list(set(SUPPORTED_DOMAINS.values()))
    return {"platforms": sorted(unique)}


@app.post("/info")
async def get_info(req: InfoRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    platform = detect_platform(url)
    if not platform:
        raise HTTPException(
            status_code=400,
            detail="Unsupported platform. Supported: TikTok, Instagram, YouTube, Facebook, Twitter/X"
        )

    try:
        info = await asyncio.wait_for(get_media_info(url), timeout=90)
        return {"success": True, "data": info}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Request timed out. Try again.")
    except Exception as e:
        error_msg = str(e)
        platform = detect_platform(url)
        if "age-restricted" in error_msg.lower():
            raise HTTPException(status_code=403, detail="This video is age-restricted and cannot be downloaded.")
        if "Cannot parse" in error_msg or "parse data" in error_msg:
            if platform == "Facebook":
                raise HTTPException(status_code=422, detail="This Facebook video is not accessible. It may be a private reel, region-locked, or require login.")
            raise HTTPException(status_code=422, detail="This link could not be parsed. Try copying the clean URL from your browser.")
        if "cookie" in error_msg.lower() or ("login" in error_msg.lower() and platform in ("Instagram", "Facebook")):
            raise HTTPException(status_code=403, detail=f"This {platform or 'content'} post requires login. Only public posts can be downloaded.")
        if "private" in error_msg.lower():
            raise HTTPException(status_code=403, detail=f"This {platform or 'content'} is private. Only public content can be downloaded.")
        if "confirm" in error_msg.lower() or "bot" in error_msg.lower() or "sign in" in error_msg.lower():
            raise HTTPException(status_code=503, detail="This video is temporarily unavailable from this server. Try again in a few seconds.")
        raise HTTPException(status_code=500, detail=f"Failed to fetch info: {error_msg}")


@app.post("/download")
async def download(req: DownloadRequest, background_tasks: BackgroundTasks):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    platform = detect_platform(url)
    if not platform:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    try:
        result = await asyncio.wait_for(
            download_media(url, req.quality, req.media_type),
            timeout=120
        )

        file_path = result["file_path"]
        filename = result["filename"]

        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Download failed - file not found")

        background_tasks.add_task(cleanup_file, file_path)

        ext = result.get("ext", "mp4")
        media_type_map = {
            "mp4": "video/mp4",
            "webm": "video/webm",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "mp3": "audio/mpeg",
            "m4a": "audio/mp4",
        }
        content_type = media_type_map.get(ext, "application/octet-stream")

        safe_filename = filename.encode('ascii', 'ignore').decode('ascii')
        return FileResponse(
            path=file_path,
            filename=safe_filename,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )

    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Download timed out. The file may be too large.")
    except Exception as e:
        error_msg = str(e)
        if "Private" in error_msg or "login" in error_msg.lower():
            raise HTTPException(status_code=403, detail="This content is private or requires login.")
        if "Cannot parse" in error_msg or "parse data" in error_msg:
            p = detect_platform(url)
            if p == "Facebook":
                raise HTTPException(status_code=422, detail="This Facebook video is not accessible. It may be a private reel, region-locked, or require a Facebook login.")
            raise HTTPException(status_code=422, detail="This link could not be parsed. Try the clean URL from your browser.")
        raise HTTPException(status_code=500, detail=f"Download failed: {error_msg}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)


@app.get("/download")
async def download_get(
    url: str,
    quality: str = "best",
    media_type: str = "video",
    custom_filename: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
):
    """GET version for direct browser navigation (triggers native download)."""
    from fastapi import BackgroundTasks as BT
    req = DownloadRequest(url=url, quality=quality, media_type=media_type)
    bt = background_tasks or BT()
    response = await download(req, bt)
    # Override filename if user provided one
    if custom_filename and hasattr(response, "headers"):
        safe = custom_filename.encode('ascii', 'ignore').decode('ascii').replace('"', '').replace("'", "")
        response.headers["content-disposition"] = f'attachment; filename="{safe}"'
    return response
