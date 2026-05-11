from __future__ import annotations

import tempfile
import os
from pathlib import Path


def is_youtube_url(source: str) -> bool:
    """Return True if the string looks like a YouTube URL."""
    return any(
        domain in source
        for domain in ("youtube.com/watch", "youtu.be/", "youtube.com/shorts/")
    )


def download_video(url: str, output_dir: str | None = None) -> str:
    """
    Download a YouTube video to a temp file and return its path.

    Parameters
    ----------
    url : str
        YouTube video URL.
    output_dir : str, optional
        Directory to save the file. Defaults to the system temp directory.

    Returns
    -------
    str
        Path to the downloaded ``.mp4`` file.

    Raises
    ------
    ImportError
        If ``yt-dlp`` is not installed.
    RuntimeError
        If the download fails.
    """
    import yt_dlp
    output_dir = output_dir or tempfile.gettempdir()
    # Use a fixed filename template so we can predict the output path
    output_template = str(Path(output_dir) / "suspectiq_yt_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        # Only download the first 60 seconds — enough for inference
        "download_ranges": lambda info, *_: [{"start_time": 0, "end_time": 60}],
        "force_keyframes_at_cuts": False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            raise RuntimeError(f"Failed to fetch video info for: {url}")

        video_id = info.get("id", "unknown")
        ext = info.get("ext", "mp4")
        output_path = str(Path(output_dir) / f"suspectiq_yt_{video_id}.{ext}")

    if not os.path.exists(output_path):
        raise RuntimeError(
            f"Download appeared to succeed but file not found at: {output_path}"
        )

    return output_path
