"""HTML parser for extracting content from SVS pages."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from urllib.parse import urljoin

import bleach
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

# Allowed HTML tags and attributes for sanitization
ALLOWED_TAGS = ["p", "br", "a", "strong", "b", "em", "i", "ul", "ol", "li", "span"]
ALLOWED_ATTRS = {"a": ["href", "title", "data-internal"]}

SVS_BASE_URL = "https://svs.gsfc.nasa.gov"


@dataclass
class ParsedCredit:
    """Parsed credit/attribution."""

    role: str
    name: str
    organization: str | None = None


@dataclass
class ParsedAssetFile:
    """Parsed asset file variant."""

    variant: str  # original, hires, lores, etc.
    url: str
    mime_type: str | None = None
    size_bytes: int | None = None
    filename: str | None = None
    dimensions: tuple[int, int] | None = None  # width, height


@dataclass
class ParsedAsset:
    """Parsed media asset."""

    title: str | None
    description: str | None
    media_type: str  # video, image, data
    files: list[ParsedAssetFile] = field(default_factory=list)
    thumbnail_url: str | None = None
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    # Rich caption with HTML formatting preserved
    caption_html: str | None = None
    caption_text: str | None = None


@dataclass
class ParsedRelatedPage:
    """Parsed related SVS page reference."""

    svs_id: int
    title: str
    relation_type: str = "related"


@dataclass
class ParsedSvsPage:
    """Parsed SVS page content."""

    svs_id: int
    title: str
    canonical_url: str
    description: str | None = None
    summary: str | None = None
    published_date: date | None = None
    thumbnail_url: str | None = None  # Main page thumbnail from og:image
    credits: list[ParsedCredit] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    missions: list[str] = field(default_factory=list)
    targets: list[str] = field(default_factory=list)
    domains: list[str] = field(default_factory=list)
    assets: list[ParsedAsset] = field(default_factory=list)
    related_pages: list[ParsedRelatedPage] = field(default_factory=list)
    download_notes: str | None = None
    # Rich content with HTML formatting preserved
    # Structure: {"format_version": 1, "sections": [{"type": "description", "paragraphs": [{"html": "...", "text": "..."}]}]}
    content_json: dict | None = None


class SvsHtmlParser:
    """Parser for SVS HTML pages."""

    def __init__(self):
        self.size_pattern = re.compile(r"\[(\d+(?:\.\d+)?)\s*(KB|MB|GB)\]", re.IGNORECASE)
        self.dimension_pattern = re.compile(r"\((\d+)\s*[x×]\s*(\d+)\)")
        self.duration_pattern = re.compile(r"(\d+):(\d+)(?::(\d+))?")
        self.svs_id_pattern = re.compile(r"/(\d+)/?$")

    def parse(self, html: str, svs_id: int) -> ParsedSvsPage:
        """
        Parse an SVS HTML page.

        Args:
            html: Raw HTML content
            svs_id: SVS page ID

        Returns:
            ParsedSvsPage with extracted content
        """
        soup = BeautifulSoup(html, "lxml")

        page = ParsedSvsPage(
            svs_id=svs_id,
            title=self._extract_title(soup),
            canonical_url=f"{SVS_BASE_URL}/{svs_id}",
        )

        # Extract main content sections
        page.description = self._extract_description(soup)
        page.summary = self._extract_summary(soup) or page.description
        page.content_json = self._extract_rich_content(soup)  # Rich HTML content
        page.published_date = self._extract_date(soup)
        page.thumbnail_url = self._extract_thumbnail(soup)
        page.credits = self._extract_credits(soup)

        # Extract categorization from article:tag meta elements
        page.keywords = self._extract_article_tags(soup)
        page.missions = self._extract_missions(soup)
        page.targets = self._extract_targets(soup)
        page.domains = self._extract_domains(soup)

        # Extract media assets from media_group sections
        page.assets = self._extract_assets(soup)

        # Extract related pages
        page.related_pages = self._extract_related_pages(soup)

        # Extract download notes
        page.download_notes = self._extract_download_notes(soup)

        return page

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title."""
        # Try the main title element (SVS uses h1#title)
        title_elem = soup.find("h1", id="title")
        if title_elem:
            return title_elem.get_text(strip=True)

        # Try h1 with class title
        title_elem = soup.find("h1", class_="title")
        if title_elem:
            return title_elem.get_text(strip=True)

        # Fall back to page title
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)
            # Remove "NASA SVS |" prefix
            if "NASA SVS |" in title:
                title = title.split("NASA SVS |")[1].strip()
            # Remove " - NASA Scientific Visualization Studio" suffix
            if " - NASA" in title:
                title = title.split(" - NASA")[0]
            return title

        return "Untitled"

    def _extract_description(self, soup: BeautifulSoup) -> str | None:
        """Extract main description/story text from media groups."""
        descriptions = []

        # Look for media group sections - they contain the actual descriptions
        media_groups = soup.find_all("section", id=re.compile(r"media_group_\d+"))

        for group in media_groups:
            # Get description text from paragraphs, excluding download menus
            # The description is typically in the card-body or after the video
            desc_container = group.find("div", class_="card-body")
            if desc_container:
                # Find description paragraphs (skip download dropdowns)
                for p in desc_container.find_all("p", recursive=True):
                    # Skip if inside dropdown menu
                    if p.find_parent(class_="dropdown-menu"):
                        continue
                    text = self._clean_text(p.get_text())
                    if text and len(text) > 20:  # Skip very short text
                        descriptions.append(text)

            # Also check for standalone description divs
            standalone = group.find("div", class_=re.compile(r"px-0|description"))
            if standalone:
                for p in standalone.find_all("p", recursive=True):
                    text = self._clean_text(p.get_text())
                    if text and len(text) > 20:
                        descriptions.append(text)

        if descriptions:
            # Deduplicate descriptions (same text may appear in multiple media groups)
            seen = set()
            unique_descs = []
            for desc in descriptions:
                # Normalize for comparison
                normalized = desc.lower().strip()[:100]  # Compare first 100 chars
                if normalized not in seen:
                    seen.add(normalized)
                    unique_descs.append(desc)
            return " ".join(unique_descs)

        # Fallback: Try JSON-LD for description (but not the meta description which has file list)
        script = soup.find("script", attrs={"type": "application/ld+json"})
        if script:
            try:
                data = json.loads(script.string)
                # JSON-LD doesn't have the file list concatenated
                if "description" in data:
                    desc = data["description"]
                    # Make sure it's not the corrupted meta description
                    if "||" not in desc:
                        return desc
            except (json.JSONDecodeError, TypeError):
                pass

        return None

    def _extract_summary(self, soup: BeautifulSoup) -> str | None:
        """Extract short summary - first paragraph of description."""
        desc = self._extract_description(soup)
        if desc:
            # Take first sentence or paragraph as summary
            sentences = desc.split(". ")
            if sentences:
                summary = sentences[0]
                if not summary.endswith("."):
                    summary += "."
                return summary[:500]  # Limit length
        return None

    def _extract_rich_content(self, soup: BeautifulSoup) -> dict | None:
        """
        Extract structured content preserving HTML formatting and links.

        Returns:
            dict: Structured content with format:
                {
                    "format_version": 1,
                    "sections": [
                        {
                            "type": "description",
                            "paragraphs": [
                                {"html": "<p>Sanitized HTML...</p>", "text": "Plain text..."}
                            ]
                        }
                    ]
                }
        """
        sections = []

        # Look for media group sections - they contain the actual descriptions
        media_groups = soup.find_all("section", id=re.compile(r"media_group_\d+"))

        for group in media_groups:
            paragraphs = []

            # Get description text from paragraphs in card-body
            desc_container = group.find("div", class_="card-body")
            if desc_container:
                for p in desc_container.find_all("p", recursive=True):
                    # Skip if inside dropdown menu
                    if p.find_parent(class_="dropdown-menu"):
                        continue

                    # Transform internal SVS links before extracting
                    self._transform_internal_links(p)

                    # Get plain text for search/accessibility
                    text = self._clean_text(p.get_text())
                    if text and len(text) > 20:  # Skip very short text
                        # Sanitize HTML to only allow safe tags
                        html = bleach.clean(str(p), tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
                        paragraphs.append({"html": html, "text": text})

            # Also check for standalone description divs
            standalone = group.find("div", class_=re.compile(r"px-0|description"))
            if standalone:
                for p in standalone.find_all("p", recursive=True):
                    # Skip if inside dropdown menu
                    if p.find_parent(class_="dropdown-menu"):
                        continue

                    # Transform internal SVS links before extracting
                    self._transform_internal_links(p)

                    text = self._clean_text(p.get_text())
                    if text and len(text) > 20:
                        html = bleach.clean(str(p), tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
                        # Deduplicate based on text content
                        if not any(para["text"] == text for para in paragraphs):
                            paragraphs.append({"html": html, "text": text})

            if paragraphs:
                sections.append({"type": "description", "paragraphs": paragraphs})

        if not sections:
            return None

        return {"format_version": 1, "sections": sections}

    def _transform_internal_links(self, element: Tag) -> None:
        """
        Transform internal SVS links to app routes.

        Converts links like /14685/ or /14685 to /svs/14685
        and marks them with data-internal="true" for frontend handling.
        """
        for link in element.find_all("a", href=True):
            href = link["href"]
            # Match /NNNN/ or /NNNN pattern (SVS page links)
            match = re.match(r"^/(\d+)/?$", href)
            if match:
                svs_id = match.group(1)
                link["href"] = f"/svs/{svs_id}"
                link["data-internal"] = "true"

    def _extract_thumbnail(self, soup: BeautifulSoup) -> str | None:
        """Extract main thumbnail URL from og:image or video poster."""
        # Try og:image meta tag first
        og_image = soup.find("meta", attrs={"property": "og:image"})
        if og_image and og_image.get("content"):
            url = og_image["content"]
            return urljoin(SVS_BASE_URL, url)

        # Try first video poster
        video = soup.find("video")
        if video and video.get("poster"):
            return urljoin(SVS_BASE_URL, video["poster"])

        # Try JSON-LD thumbnailUrl
        script = soup.find("script", attrs={"type": "application/ld+json"})
        if script:
            try:
                data = json.loads(script.string)
                if "thumbnailUrl" in data:
                    return urljoin(SVS_BASE_URL, data["thumbnailUrl"])
            except (json.JSONDecodeError, TypeError):
                pass

        return None

    def _extract_date(self, soup: BeautifulSoup) -> date | None:
        """Extract publication date."""
        # Try article:published_time meta tag (most reliable for SVS)
        meta_date = soup.find("meta", attrs={"property": "article:published_time"})
        if meta_date and meta_date.get("content"):
            return self._parse_date(meta_date["content"])

        # Try time element
        time_elem = soup.find("time")
        if time_elem:
            date_str = time_elem.get("datetime") or time_elem.get_text(strip=True)
            return self._parse_date(date_str)

        return None

    def _parse_date(self, date_str: str) -> date | None:
        """Parse various date formats."""
        if not date_str:
            return None

        # Common formats
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",  # ISO with timezone
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
            "%B %d, %Y",
            "%b %d, %Y",
            "%m/%d/%Y",
        ]

        for fmt in formats:
            try:
                # Handle timezone offset like -04:00
                clean_str = date_str.strip()
                if fmt == "%Y-%m-%dT%H:%M:%S%z" and ":" == clean_str[-3:-2]:
                    # Remove colon from timezone offset for Python < 3.11
                    clean_str = clean_str[:-3] + clean_str[-2:]
                return datetime.strptime(clean_str[:25], fmt).date()
            except ValueError:
                continue

        # Try without timezone
        try:
            return datetime.strptime(date_str[:19], "%Y-%m-%dT%H:%M:%S").date()
        except ValueError:
            pass

        return None

    def _extract_credits(self, soup: BeautifulSoup) -> list[ParsedCredit]:
        """Extract credits/attribution from various page locations."""
        credits = []

        # 1. Try JSON-LD first (most reliable when present)
        script = soup.find("script", attrs={"type": "application/ld+json"})
        if script:
            try:
                data = json.loads(script.string)
                # Check for author field
                if "author" in data:
                    authors = data["author"]
                    if isinstance(authors, dict):
                        authors = [authors]
                    for author in authors:
                        if isinstance(author, dict) and "name" in author:
                            credits.append(
                                ParsedCredit(
                                    role="Author",
                                    name=author["name"],
                                    organization=author.get("affiliation", {}).get("name")
                                    if isinstance(author.get("affiliation"), dict)
                                    else None,
                                )
                            )
                        elif isinstance(author, str):
                            credits.append(
                                ParsedCredit(
                                    role="Author",
                                    name=author,
                                    organization=None,
                                )
                            )
                # Check for contributor field
                if "contributor" in data:
                    contributors = data["contributor"]
                    if isinstance(contributors, dict):
                        contributors = [contributors]
                    for contrib in contributors:
                        if isinstance(contrib, dict) and "name" in contrib:
                            credits.append(
                                ParsedCredit(
                                    role=contrib.get("jobTitle", "Contributor"),
                                    name=contrib["name"],
                                    organization=contrib.get("affiliation", {}).get("name")
                                    if isinstance(contrib.get("affiliation"), dict)
                                    else None,
                                )
                            )
            except (json.JSONDecodeError, TypeError, KeyError):
                pass

        # 2. Look in header area with various class patterns
        # SVS pages have credits in header with links to /search?people=NAME
        # Try multiple patterns for the credit list
        credit_patterns = [
            {"class_": re.compile(r"hstack.*list-unstyled")},
            {"class_": "credits"},
            {"class_": re.compile(r"credit")},
        ]

        for pattern in credit_patterns:
            credit_lists = soup.find_all("ul", **pattern)
            for credit_list in credit_lists:
                role = None
                # Look for role label (bold text ending in colon)
                role_elem = credit_list.find(class_="fw-bold") or credit_list.find("strong")
                if role_elem:
                    role_text = role_elem.get_text(strip=True)
                    if role_text.endswith(":"):
                        role = role_text[:-1].strip()

                # Find all person links
                for link in credit_list.find_all("a", href=re.compile(r"/search\?people=")):
                    name = link.get_text(strip=True)
                    if name and role:
                        credits.append(
                            ParsedCredit(
                                role=role,
                                name=name,
                                organization=None,
                            )
                        )

        # 3. Look for header spans/divs with credit info
        header = soup.find("header") or soup.find("div", class_="header")
        if header:
            for span in header.find_all(["span", "div"], class_=re.compile(r"credit|author")):
                text = span.get_text(strip=True)
                # Pattern: "Role: Name" or "Role by Name"
                role_match = re.match(r"^([^:]+):\s*(.+)$", text)
                if role_match:
                    role, name = role_match.groups()
                    # Check for organization in parentheses
                    org_match = re.search(r"\(([^)]+)\)$", name)
                    org = org_match.group(1) if org_match else None
                    if org_match:
                        name = name[: org_match.start()].strip()
                    credits.append(
                        ParsedCredit(
                            role=role.strip(),
                            name=name.strip(),
                            organization=org,
                        )
                    )

        # 4. Look in the dedicated credits section
        credits_section = soup.find("section", id="section_credits")
        if credits_section:
            current_role = None
            for elem in credits_section.find_all(["dt", "dd", "h4", "h5", "li", "p"]):
                if elem.name in ["dt", "h4", "h5"]:
                    current_role = elem.get_text(strip=True).rstrip(":")
                elif elem.name in ["dd", "li", "p"] and current_role:
                    # Look for links or just text
                    link = elem.find("a")
                    if link:
                        name = link.get_text(strip=True)
                    else:
                        name = elem.get_text(strip=True)

                    if name and len(name) > 1:
                        # Check for organization in parentheses
                        org_match = re.search(r"\(([^)]+)\)$", name)
                        org = org_match.group(1) if org_match else None
                        if org_match:
                            name = name[: org_match.start()].strip()

                        credits.append(
                            ParsedCredit(
                                role=current_role,
                                name=name,
                                organization=org,
                            )
                        )

        # 5. Look for credit info in description area (some pages embed credits there)
        for media_group in soup.find_all("section", id=re.compile(r"media_group_\d+")):
            card_body = media_group.find("div", class_="card-body")
            if card_body:
                # Look for "Credit:" patterns
                for p in card_body.find_all("p"):
                    text = p.get_text(strip=True)
                    credit_match = re.match(r"^Credits?:\s*(.+)$", text, re.IGNORECASE)
                    if credit_match:
                        credit_text = credit_match.group(1)
                        # Handle multiple credits separated by semicolons or commas
                        for part in re.split(r"[;,]", credit_text):
                            part = part.strip()
                            if part:
                                # Try to extract role from pattern "Name (Role)"
                                role_match = re.search(r"\(([^)]+)\)$", part)
                                if role_match:
                                    org_or_role = role_match.group(1)
                                    name = part[: role_match.start()].strip()
                                    # Guess if it's a role or org
                                    role_keywords = [
                                        "animator",
                                        "visualiz",
                                        "lead",
                                        "director",
                                        "producer",
                                        "scientist",
                                    ]
                                    if any(kw in org_or_role.lower() for kw in role_keywords):
                                        credits.append(ParsedCredit(role=org_or_role, name=name, organization=None))
                                    else:
                                        credits.append(ParsedCredit(role="Credit", name=name, organization=org_or_role))
                                else:
                                    credits.append(ParsedCredit(role="Credit", name=part, organization=None))

        # Deduplicate credits by (role, name) tuple
        seen = set()
        unique_credits = []
        for credit in credits:
            # Normalize for comparison
            key = (credit.role.lower().strip(), credit.name.lower().strip())
            if key not in seen:
                seen.add(key)
                unique_credits.append(credit)
        return unique_credits

    def _extract_article_tags(self, soup: BeautifulSoup) -> list[str]:
        """Extract keywords from article:tag meta elements."""
        keywords = []

        # SVS uses <meta property="article:tag" content="TAG"> for each tag
        for meta in soup.find_all("meta", attrs={"property": "article:tag"}):
            content = meta.get("content")
            if content:
                keywords.append(content.strip())

        # Also try meta keywords as fallback
        meta_keywords = soup.find("meta", attrs={"name": "keywords"})
        if meta_keywords and meta_keywords.get("content"):
            for kw in meta_keywords["content"].split(","):
                kw = kw.strip()
                if kw and kw not in keywords:
                    keywords.append(kw)

        return list(set(keywords))

    def _extract_missions(self, soup: BeautifulSoup) -> list[str]:
        """Extract mission names from tags."""
        # Missions are typically included in the article:tag metadata
        # We detect them by common mission names
        missions = []
        known_missions = {
            "MAVEN",
            "Hubble",
            "Webb",
            "JWST",
            "Cassini",
            "Curiosity",
            "Perseverance",
            "Mars Reconnaissance Orbiter",
            "MRO",
            "LRO",
            "TESS",
            "Kepler",
            "Spitzer",
            "Chandra",
            "Fermi",
            "SDO",
            "SOHO",
            "ACE",
            "STEREO",
            "Parker Solar Probe",
            "New Horizons",
            "Juno",
            "Europa Clipper",
            "OSIRIS-REx",
            "GOES",
            "Landsat",
            "Terra",
            "Aqua",
            "NOAA",
            "GPM",
            "ICESat",
            "GRACE",
        }

        tags = self._extract_article_tags(soup)
        for tag in tags:
            # Check if tag matches or contains a known mission
            tag_upper = tag.upper()
            for mission in known_missions:
                if mission.upper() in tag_upper:
                    missions.append(tag)
                    break

        return list(set(missions))

    def _extract_targets(self, soup: BeautifulSoup) -> list[str]:
        """Extract celestial body targets from tags."""
        targets = []
        known_targets = {
            "Earth",
            "Moon",
            "Sun",
            "Mars",
            "Jupiter",
            "Saturn",
            "Venus",
            "Mercury",
            "Uranus",
            "Neptune",
            "Pluto",
            "Europa",
            "Titan",
            "Enceladus",
            "Io",
            "Ganymede",
            "Callisto",
            "Ceres",
            "Vesta",
            "Bennu",
            "Ryugu",
            "Comet",
        }

        tags = self._extract_article_tags(soup)
        for tag in tags:
            tag_upper = tag.upper()
            for target in known_targets:
                if target.upper() in tag_upper:
                    targets.append(tag)
                    break

        return list(set(targets))

    def _extract_domains(self, soup: BeautifulSoup) -> list[str]:
        """Extract scientific domains from tags."""
        domains = []
        known_domains = {
            "Earth Science",
            "Heliophysics",
            "Astrophysics",
            "Planetary Science",
            "Climate",
            "Weather",
            "Atmosphere",
            "Ocean",
            "Land",
            "Ice",
            "Solar",
            "Space Weather",
            "Galaxies",
            "Black Holes",
            "Stars",
            "Exoplanets",
            "Nebulae",
            "Universe",
            "Cosmology",
        }

        tags = self._extract_article_tags(soup)
        for tag in tags:
            tag_upper = tag.upper()
            for domain in known_domains:
                if domain.upper() in tag_upper:
                    domains.append(tag)
                    break

        return list(set(domains))

    def _extract_assets(self, soup: BeautifulSoup) -> list[ParsedAsset]:
        """Extract media assets from media_group sections."""
        assets = []

        # Find all media group sections
        media_groups = soup.find_all("section", id=re.compile(r"media_group_\d+"))

        for group in media_groups:
            asset = self._parse_media_group(group)
            if asset:
                assets.append(asset)

        return assets

    def _parse_media_group(self, section: Tag) -> ParsedAsset | None:
        """Parse a media_group section into an asset."""
        # Determine media type
        media_type = "image"
        video = section.find("video")
        if video:
            media_type = "video"

        # Get thumbnail from video poster or first image
        thumbnail_url = None
        if video and video.get("poster"):
            thumbnail_url = urljoin(SVS_BASE_URL, video["poster"])
        else:
            img = section.find("img")
            if img and img.get("src"):
                thumbnail_url = urljoin(SVS_BASE_URL, img["src"])

        # Extract description
        description = None
        card_body = section.find("div", class_="card-body")
        if card_body:
            desc_parts = []
            for p in card_body.find_all("p", recursive=False):
                text = self._clean_text(p.get_text())
                if text:
                    desc_parts.append(text)
            if desc_parts:
                description = " ".join(desc_parts)

        # Extract download files from dropdown menu
        files = []
        dropdown = section.find("ul", class_="dropdown-menu")
        if dropdown:
            for link in dropdown.find_all("a", class_="dropdown-item"):
                file_info = self._parse_download_link(link)
                if file_info:
                    files.append(file_info)

        # If no dropdown, try direct video sources
        if not files and video:
            for source in video.find_all("source"):
                src = source.get("src")
                if src:
                    url = urljoin(SVS_BASE_URL, src)
                    files.append(
                        ParsedAssetFile(
                            variant=self._detect_variant(url),
                            url=url,
                            mime_type=source.get("type"),
                            filename=url.split("/")[-1] if "/" in url else None,
                        )
                    )

        if not files and not thumbnail_url:
            return None

        return ParsedAsset(
            title=None,  # SVS doesn't typically have per-asset titles
            description=description,
            media_type=media_type,
            files=files,
            thumbnail_url=thumbnail_url,
        )

    def _parse_download_link(self, link: Tag) -> ParsedAssetFile | None:
        """Parse a download dropdown link into a file."""
        href = link.get("href", "")
        if not href:
            return None

        url = urljoin(SVS_BASE_URL, href)
        text = link.get_text(strip=True)

        # Extract size from text like "file.mov (1920x1080) [6.5 GB]"
        size_bytes = None
        size_match = self.size_pattern.search(text)
        if size_match:
            size = float(size_match.group(1))
            unit = size_match.group(2).upper()
            multipliers = {"KB": 1024, "MB": 1024**2, "GB": 1024**3}
            size_bytes = int(size * multipliers.get(unit, 1))

        # Extract dimensions
        dimensions = None
        dim_match = self.dimension_pattern.search(text)
        if dim_match:
            dimensions = (int(dim_match.group(1)), int(dim_match.group(2)))

        # Detect variant from filename/url
        variant = self._detect_variant(url)

        # Detect mime type
        mime_type = self._detect_mime_type(url)

        # Extract filename
        filename = url.split("/")[-1] if "/" in url else None

        return ParsedAssetFile(
            variant=variant,
            url=url,
            mime_type=mime_type,
            size_bytes=size_bytes,
            filename=filename,
            dimensions=dimensions,
        )

    def _detect_variant(self, url: str) -> str:
        """Detect file variant from URL/filename."""
        url_lower = url.lower()

        if "4k" in url_lower or "uhd" in url_lower:
            return "4k"
        if "1080" in url_lower or "hd" in url_lower:
            return "1080p"
        if "720" in url_lower:
            return "720p"
        if "prores" in url_lower:
            return "prores"
        if "h264" in url_lower:
            return "h264"
        if "appletv" in url_lower:
            return "appletv"
        if "webm" in url_lower:
            return "webm"
        if "ipod" in url_lower or "podcast" in url_lower:
            return "mobile"
        if "thumbnail" in url_lower or "thm" in url_lower:
            return "thumbnail"
        if "print" in url_lower:
            return "print"
        if "searchweb" in url_lower:
            return "web"
        if ".srt" in url_lower or ".vtt" in url_lower:
            return "caption"
        if "transcript" in url_lower:
            return "transcript"

        return "original"

    def _extract_related_pages(self, soup: BeautifulSoup) -> list[ParsedRelatedPage]:
        """Extract related SVS pages."""
        related = []

        # Look for "See Also" or related sections
        related_section = soup.find("section", id=re.compile(r"related|see.*also", re.I))
        if not related_section:
            # Try finding by heading
            for heading in soup.find_all(["h2", "h3", "h4"]):
                if "related" in heading.get_text().lower() or "see also" in heading.get_text().lower():
                    related_section = heading.find_parent("section") or heading.find_next("ul")
                    break

        if related_section:
            for link in related_section.find_all("a", href=True):
                href = link["href"]
                match = self.svs_id_pattern.search(href)
                if match:
                    svs_id = int(match.group(1))
                    title = link.get_text(strip=True)
                    if title:
                        related.append(
                            ParsedRelatedPage(
                                svs_id=svs_id,
                                title=title,
                                relation_type="related",
                            )
                        )

        # Also look at prev/next navigation
        nav_row = soup.find("nav", class_="row")
        if nav_row:
            for link in nav_row.find_all("a", href=True):
                href = link["href"]
                match = self.svs_id_pattern.search(href)
                if match:
                    svs_id = int(match.group(1))
                    title = link.get_text(strip=True)
                    if title and not title.startswith("bi-"):
                        related.append(
                            ParsedRelatedPage(
                                svs_id=svs_id,
                                title=title,
                                relation_type="sequence",
                            )
                        )

        return related

    def _extract_download_notes(self, soup: BeautifulSoup) -> str | None:
        """Extract download/usage notes."""
        notes_section = soup.find("div", class_=re.compile(r"download-notes|usage"))
        if notes_section:
            return self._clean_text(notes_section.get_text())
        return None

    def _detect_mime_type(self, url: str) -> str | None:
        """Detect MIME type from URL."""
        extension_map = {
            ".mp4": "video/mp4",
            ".m4v": "video/mp4",
            ".mov": "video/quicktime",
            ".webm": "video/webm",
            ".mpeg": "video/mpeg",
            ".mpg": "video/mpeg",
            ".avi": "video/x-msvideo",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".tif": "image/tiff",
            ".tiff": "image/tiff",
            ".gif": "image/gif",
            ".vtt": "text/vtt",
            ".srt": "text/plain",
        }
        url_lower = url.lower()
        for ext, mime in extension_map.items():
            if url_lower.endswith(ext):
                return mime
        return None

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        # Remove excess whitespace
        text = re.sub(r"\s+", " ", text)
        return text.strip()
