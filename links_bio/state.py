import asyncio
import re
import urllib.request
import xml.etree.ElementTree as ET

import reflex as rx

from links_bio.constants.url_social import YOUTUBE_CHANNEL_ID, YOUTUBE_CHANNEL_URL


class AppState(rx.State):
    youtube_videos: list[dict[str, str]] = []
    youtube_error: str = ""

    async def load_youtube_videos(self) -> None:
        if self.youtube_videos:
            return

        channel_id = YOUTUBE_CHANNEL_ID
        if not channel_id:
            channel_id = await asyncio.to_thread(
                self._resolve_channel_id, YOUTUBE_CHANNEL_URL
            )

        if not channel_id:
            self.youtube_videos = []
            self.youtube_error = "No se pudo encontrar el canal de YouTube."
            return

        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

        try:
            raw_xml = await asyncio.to_thread(self._fetch_feed, feed_url)
            self.youtube_videos = self._parse_feed(raw_xml)
            self.youtube_error = ""
        except Exception:
            self.youtube_videos = []
            self.youtube_error = "No se pudieron cargar los videos recientes."

    def _fetch_feed(self, feed_url: str) -> bytes:
        with urllib.request.urlopen(feed_url, timeout=10) as response:
            return response.read()

    def _resolve_channel_id(self, channel_url: str) -> str:
        with urllib.request.urlopen(channel_url, timeout=10) as response:
            html = response.read().decode("utf-8", errors="ignore")

        match = re.search(r'"channelId":"(UC[^"]+)"', html)
        if match:
            return match.group(1)

        return ""

    def _parse_feed(self, raw_xml: bytes) -> list[dict[str, str]]:
        root = ET.fromstring(raw_xml)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "media": "http://search.yahoo.com/mrss/",
        }

        videos: list[dict[str, str]] = []
        for entry in root.findall("atom:entry", ns)[:4]:
            title = entry.findtext("atom:title", default="", namespaces=ns)
            link = entry.find("atom:link", ns)
            video_url = ""
            if link is not None:
                video_url = link.get("href") or ""
            thumbnail = ""
            media_group = entry.find("media:group", ns)
            if media_group is not None:
                thumb = media_group.find("media:thumbnail", ns)
                if thumb is not None:
                    thumbnail = thumb.get("url") or ""

            videos.append(
                {
                    "title": title,
                    "url": video_url,
                    "thumbnail": thumbnail,
                }
            )

        return videos
