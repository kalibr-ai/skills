"""
Video/Audio Downloader - Support online videos and local files
"""

import os
import subprocess
import json
from pathlib import Path
from typing import Tuple, Optional

import yt_dlp


class Downloader:
    """Handle video and audio downloading."""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True, parents=True)

    def get_audio(self, source: str) -> Tuple[str, dict]:
        """
        Get audio from video URL or local file.

        Returns:
            Tuple of (audio_path, video_info)
        """
        if self._is_local_file(source):
            return self._extract_audio(source)
        else:
            return self._download_audio(source)

    def get_video(self, source: str) -> Tuple[str, dict]:
        """
        Get video file from URL or local file path.

        Args:
            source: Video URL or local file path

        Returns:
            Tuple of (video_path, video_info)
            video_info contains: title, url, platform, duration
        """
        if self._is_local_file(source):
            return self._validate_local_video(source)
        else:
            return self._download_video(source)

    def _is_local_file(self, path: str) -> bool:
        """Check if source is a local file."""
        if os.path.exists(path):
            return True
        if not path.startswith(("http://", "https://")):
            return True
        return False

    def _detect_platform(self, url: str) -> str:
        """Detect video platform."""
        url_lower = url.lower()
        if "bilibili.com" in url_lower or "b23.tv" in url_lower:
            return "Bilibili"
        elif "youtube.com" in url_lower or "youtu.be" in url_lower:
            return "YouTube"
        else:
            return "Unknown"

    def _download_audio(self, url: str) -> Tuple[str, dict]:
        """Download audio from online video."""
        output_template = str(self.data_dir / "%(id)s.%(ext)s")

        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "64",
                }
            ],
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "nocheckcertificate": True,
            "http_chunk_size": 10485760,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "unknown")
            title = info.get("title", "Unknown Title")
            audio_path = str(self.data_dir / f"{video_id}.mp3")

        return audio_path, {
            "title": title,
            "url": url,
            "platform": self._detect_platform(url),
        }

    def _extract_audio(self, video_path: str) -> Tuple[str, dict]:
        """Extract audio from local video file."""
        video_file = Path(video_path)

        # Validate
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        video_extensions = {
            ".mp4",
            ".avi",
            ".mkv",
            ".mov",
            ".flv",
            ".wmv",
            ".webm",
            ".m4v",
        }
        if video_file.suffix.lower() not in video_extensions:
            raise ValueError(f"Unsupported video format: {video_file.suffix}")

        # Extract audio
        audio_path = str(self.data_dir / f"{video_file.stem}.mp3")

        cmd = [
            "ffmpeg",
            "-i",
            video_path,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-ab",
            "64k",
            "-ar",
            "44100",
            "-y",
            audio_path,
        ]

        result = subprocess.run(cmd, capture_output=True, check=True)

        return audio_path, {
            "title": video_file.stem,
            "url": video_path,
            "platform": "Local",
        }

    def _download_video(self, url: str) -> Tuple[str, dict]:
        """Download video file from online source."""
        output_template = str(self.data_dir / "%(id)s.%(ext)s")

        ydl_opts = {
            "format": "bestvideo+bestaudio/best",
            "outtmpl": output_template,
            "merge_output_format": "mp4",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "nocheckcertificate": True,
            "http_chunk_size": 10485760,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "unknown")
            title = info.get("title", "Unknown Title")
            duration = info.get("duration", 0)
            video_path = str(self.data_dir / f"{video_id}.mp4")

        return video_path, {
            "title": title,
            "url": url,
            "platform": self._detect_platform(url),
            "duration": duration,
        }

    def _validate_local_video(self, video_path: str) -> Tuple[str, dict]:
        """Validate local video file and return info."""
        video_file = Path(video_path)

        # Validate file exists
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Validate video extension
        video_extensions = {
            ".mp4",
            ".avi",
            ".mkv",
            ".mov",
            ".flv",
            ".wmv",
            ".webm",
            ".m4v",
        }
        if video_file.suffix.lower() not in video_extensions:
            raise ValueError(f"Unsupported video format: {video_file.suffix}")

        # Get video duration using ffprobe
        duration = self._get_video_duration(video_path)

        return str(video_file.absolute()), {
            "title": video_file.stem,
            "url": video_path,
            "platform": "Local",
            "duration": duration,
        }

    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds using ffprobe."""
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            video_path,
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, check=True, text=True)
            data = json.loads(result.stdout)
            duration = float(data.get("format", {}).get("duration", 0))
            return duration
        except (subprocess.CalledProcessError, json.JSONDecodeError, ValueError):
            # Fallback: return 0 if duration cannot be determined
            return 0.0
