"""
Video Analyzer Core - Main orchestrator class
"""

from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import time
import re
import logging

try:
    from .utils.temp_manager import temp_manager
    from .models import SummaryStyle, calculate_screenshot_count
except ImportError:
    from utils.temp_manager import temp_manager
    from models import SummaryStyle, calculate_screenshot_count


logger = logging.getLogger(__name__)


class VideoAnalyzer:
    """Main class for video analysis workflow."""

    def __init__(
        self,
        whisper_model: str = "large-v2",
        analysis_types: Optional[List[str]] = None,
        output_dir: str = "./video-analysis",
        save_transcript: bool = True,
        config_path: Optional[str] = None,
        summary_style: Optional[SummaryStyle] = None,
        enable_screenshots: bool = False,
    ):
        self.skill_dir = Path(__file__).resolve().parent
        self.whisper_model = whisper_model
        self.analysis_types = (
            ["evaluation", "summary"] if analysis_types is None else analysis_types
        )
        self.output_dir = Path(output_dir)
        self.save_transcript = save_transcript
        self.config_path = config_path
        self.summary_style = summary_style
        self.enable_screenshots = enable_screenshots

        # Lazy imports
        self._transcriber = None
        self._llm_processor = None
        self._downloader = None
        self._screenshot_extractor = None

        # Create runtime directories
        self.output_dir.mkdir(exist_ok=True, parents=True)
        (self.skill_dir / "data").mkdir(exist_ok=True, parents=True)
        (self.skill_dir / "models" / "whisper").mkdir(exist_ok=True, parents=True)
        (self.skill_dir / "logs").mkdir(exist_ok=True, parents=True)

    @property
    def transcriber(self):
        """Lazy load transcriber."""
        if self._transcriber is None:
            try:
                from .transcriber import Transcriber
            except ImportError:
                from transcriber import Transcriber

            self._transcriber = Transcriber(model_size=self.whisper_model)
        return self._transcriber

    @property
    def llm_processor(self):
        """Lazy load LLM processor."""
        if self._llm_processor is None:
            try:
                from .llm_processor import LLMProcessor
            except ImportError:
                from llm_processor import LLMProcessor

            self._llm_processor = LLMProcessor(config_path=self.config_path)
        return self._llm_processor

    @property
    def downloader(self):
        """Lazy load downloader."""
        if self._downloader is None:
            try:
                from .downloader import Downloader
            except ImportError:
                from downloader import Downloader

            self._downloader = Downloader()
        return self._downloader

    @property
    def screenshot_extractor(self):
        """Lazy load screenshot extractor."""
        if self._screenshot_extractor is None:
            try:
                from .screenshot_extractor import ScreenshotExtractor
            except ImportError:
                from screenshot_extractor import ScreenshotExtractor

            self._screenshot_extractor = ScreenshotExtractor()
        return self._screenshot_extractor

    def analyze(self, url: str) -> Dict:
        """Execute full analysis pipeline."""
        start_time = time.time()
        media_path = None

        try:
            # 1. Get media (video if screenshots enabled, audio otherwise)
            if self.enable_screenshots:
                print(f"[1/5] Downloading video: {url}")
                media_path, video_info = self.downloader.get_video(url)
                temp_manager.add(media_path)
            else:
                print(f"[1/4] Downloading: {url}")
                media_path, video_info = self.downloader.get_audio(url)
                temp_manager.add(media_path)

            # 2. Transcribe
            if self.enable_screenshots:
                print(
                    f"[2/5] Transcribing with timestamps (model: {self.whisper_model})..."
                )
                timestamped_transcript = self.transcriber.transcribe_with_timestamps(
                    media_path
                )
                # Also get plain text transcript for compatibility
                transcript = " ".join(
                    segment["text"] for segment in timestamped_transcript
                )
            else:
                print(f"[2/4] Transcribing (model: {self.whisper_model})...")
                transcript = self.transcriber.transcribe(media_path)
                timestamped_transcript = None

            # 3. Screenshot extraction (if enabled)
            key_nodes = []
            screenshot_paths = []
            if self.enable_screenshots:
                print(f"[3/5] Extracting screenshots...")
                try:
                    # Get video duration
                    duration = video_info.get("duration", 0)
                    if duration:
                        # Calculate screenshot count
                        screenshot_count = calculate_screenshot_count(duration)

                        # Select key nodes using LLM
                        duration_minutes = duration / 60.0
                        key_nodes = self.llm_processor.select_key_nodes(
                            timestamped_transcript=timestamped_transcript,
                            screenshot_count=screenshot_count,
                            video_title=video_info.get("title", ""),
                            duration_minutes=duration_minutes,
                        )

                        if key_nodes:
                            # Extract timestamps from key nodes
                            timestamps = [
                                node["timestamp_seconds"] for node in key_nodes
                            ]

                            # Create screenshot directory
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            screenshot_dir = (
                                self.output_dir / f"{timestamp}_screenshots"
                            )
                            screenshot_dir.mkdir(parents=True, exist_ok=True)

                            # Extract screenshots
                            result = self.screenshot_extractor.extract(
                                video_path=media_path,
                                timestamps=timestamps,
                                output_dir=str(screenshot_dir),
                            )

                            if result.success:
                                screenshot_paths = result.file_paths
                                logger.info(
                                    f"Extracted {len(screenshot_paths)} screenshots"
                                )
                            else:
                                logger.warning(
                                    f"Screenshot extraction failed: {result.error_message}"
                                )
                        else:
                            logger.warning(
                                "No key nodes selected, skipping screenshots"
                            )
                    else:
                        logger.warning(
                            "Video duration unavailable, skipping screenshots"
                        )
                except Exception as e:
                    logger.error(f"Screenshot extraction failed: {e}")
                    # Non-fatal: continue without screenshots

            # 4. LLM analysis
            step_num = 4 if self.enable_screenshots else 3
            print(
                f"[{step_num}/{5 if self.enable_screenshots else 4}] Analyzing ({len(self.analysis_types)} types)..."
            )
            analyses = {}
            for analysis_type in self.analysis_types:
                if analysis_type == "summary" and self.summary_style:
                    # Use style-specific summary
                    analyses[analysis_type] = self.llm_processor.process_summary(
                        text=transcript,
                        style=self.summary_style,
                        video_title=video_info.get("title", ""),
                        duration_minutes=video_info.get("duration", 0) / 60.0,
                    )
                elif analysis_type in ["evaluation", "summary", "format"]:
                    # Use default prompt-based processing
                    analyses[analysis_type] = self.llm_processor.process(
                        text=transcript, prompt_type=analysis_type
                    )

            # Insert screenshots into summary if available
            if (
                self.enable_screenshots
                and "summary" in analyses
                and screenshot_paths
                and key_nodes
            ):
                analyses["summary"] = self._generate_summary_with_screenshots(
                    summary_text=analyses["summary"],
                    key_nodes=key_nodes,
                    screenshot_paths=screenshot_paths,
                )

            # 5. Save results
            step_num = 5 if self.enable_screenshots else 4
            print(
                f"[{step_num}/{5 if self.enable_screenshots else 4}] Saving results..."
            )
            output_files = self._save_results(video_info, transcript, analyses)

            elapsed = time.time() - start_time

            return {
                "success": True,
                "video_title": video_info["title"],
                "duration_seconds": round(elapsed, 1),
                "transcript_length": len(transcript),
                "output_files": output_files,
                "summary": f"Analyzed in {elapsed:.1f}s | {len(transcript)} chars | {len(analyses)} analyses",
            }

        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return {"success": False, "error": str(e), "url": url}
        finally:
            if media_path:
                temp_manager.cleanup()

    def _generate_summary_with_screenshots(
        self, summary_text: str, key_nodes: List[Dict], screenshot_paths: List[str]
    ) -> str:
        """
        Insert inline screenshot images into summary text under key point titles.

        Args:
            summary_text: Original summary text
            key_nodes: List of key nodes with titles
            screenshot_paths: List of screenshot file paths (aligned with key_nodes)

        Returns:
            Summary text with inline images inserted
        """
        if not key_nodes or not screenshot_paths:
            return summary_text

        # Create a mapping of titles to screenshot paths
        title_to_screenshot = {}
        for i, node in enumerate(key_nodes):
            if i < len(screenshot_paths):
                title_to_screenshot[node.get("title", "")] = screenshot_paths[i]

        # Insert screenshots after matching titles
        lines = summary_text.split("\n")
        result_lines = []

        for line in lines:
            result_lines.append(line)

            # Check if this line is a header that matches a key node title
            if line.startswith("#"):
                # Extract header text (remove # and whitespace)
                header_text = line.lstrip("#").strip()

                # Check if any key node title is in this header
                for title, screenshot_path in title_to_screenshot.items():
                    if title in header_text or header_text in title:
                        # Insert screenshot image right after the header
                        result_lines.append(f"\n![Screenshot]({screenshot_path})\n")
                        break

        return "\n".join(result_lines)

    def _save_results(self, video_info, transcript, analyses) -> Dict:
        """Save all results to files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        raw_title = str(video_info.get("title", "video"))
        safe_title = re.sub(r"[^A-Za-z0-9_-]+", "_", raw_title).strip("_")[:50]
        if not safe_title:
            safe_title = "video"

        output_files = {}

        # Save transcript
        if self.save_transcript:
            transcript_file = (
                self.output_dir / f"{timestamp}_{safe_title}_transcript.md"
            )
            with open(transcript_file, "w", encoding="utf-8") as f:
                f.write(f"# {video_info['title']}\n\n")
                f.write(f"**URL**: {video_info['url']}\n")
                f.write(f"**Date**: {datetime.now().isoformat()}\n\n")
                f.write("---\n\n")
                f.write(transcript)
            output_files["transcript"] = str(transcript_file)

        # Save analyses
        for analysis_type, content in analyses.items():
            if content:
                analysis_file = (
                    self.output_dir / f"{timestamp}_{safe_title}_{analysis_type}.md"
                )
                with open(analysis_file, "w", encoding="utf-8") as f:
                    f.write(f"# {video_info['title']} - {analysis_type.upper()}\n\n")
                    f.write(content)
                output_files[analysis_type] = str(analysis_file)

        return output_files
