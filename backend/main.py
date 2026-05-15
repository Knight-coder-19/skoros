from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional
import os
import asyncio
import subprocess
import shutil

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
        ytdlp_bin = shutil.which("yt-dlp") or str(
            __import__("pathlib").Path(__file__).parent / ".venv/bin/yt-dlp"
        )

        import uuid, re as _re
        job_id = str(uuid.uuid4())[:8]
        out_file = f"/tmp/skoros_dl_{job_id}.%(ext)s"

        if req.media_type == "audio":
            cmd = [
                ytdlp_bin, "-f", "bestaudio/best",
                "--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K",
                "--no-part", "-o", out_file, "--quiet", url,
            ]
            ext = "mp3"
            mime = "audio/mpeg"
        else:
            quality_map = {
                "best":   "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "medium": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]",
                "low":    "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]",
            }
            fmt = quality_map.get(req.quality or "best", quality_map["best"])
            cmd = [
                ytdlp_bin, "-f", fmt, "--merge-output-format", "mp4",
                "--no-part", "-o", out_file, "--quiet", url,
            ]
            ext = "mp4"
            mime = "video/mp4"

        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr_output = await proc.communicate()

        import glob
        matches = glob.glob(f"/tmp/skoros_dl_{job_id}.*")
        if not matches:
            err_detail = stderr_output.decode(errors="replace").strip()[-300:] if stderr_output else "no output"
            raise HTTPException(status_code=500, detail=f"Download produced no output file. yt-dlp: {err_detail}")
        out_path = matches[0]
        ext = out_path.rsplit(".", 1)[-1]
        mime = "audio/mpeg" if ext == "mp3" else "video/mp4"

        file_size = os.path.getsize(out_path)

        async def stream_file():
            try:
                with open(out_path, "rb") as f:
                    while chunk := f.read(256 * 1024):
                        yield chunk
            finally:
                try:
                    os.remove(out_path)
                except Exception:
                    pass

        safe_fn = _re.sub(r'[^\w\-.]', '_', os.path.basename(out_path))
        return StreamingResponse(
            stream_file(),
            media_type=mime,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_fn}"',
                "Content-Length": str(file_size),
            },
        )

    except Exception as e:
        error_msg = str(e)
        if "Private" in error_msg or "login" in error_msg.lower():
            raise HTTPException(status_code=403, detail="This content is private or requires login.")
        raise HTTPException(status_code=500, detail=f"Download failed: {error_msg}")


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
    if custom_filename and hasattr(response, "headers"):
        safe = custom_filename.encode('ascii', 'ignore').decode('ascii').replace('"', '').replace("'", "")
        response.headers["content-disposition"] = f'attachment; filename="{safe}"'
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
