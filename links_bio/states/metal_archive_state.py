import random
import reflex as rx
from sqlmodel import select, col, func
from links_bio.models.album import Album
from links_bio.models.track import Track
from links_bio.models.similar_band import SimilarBand

# Mapping de pais (espanol) -> bandera emoji
COUNTRY_FLAGS: dict[str, str] = {
    "Alemania": "\U0001F1E9\U0001F1EA",
    "Arabia Saudita": "\U0001F1F8\U0001F1E6",
    "Argelia": "\U0001F1E9\U0001F1FF",
    "Argentina": "\U0001F1E6\U0001F1F7",
    "Armenia": "\U0001F1E6\U0001F1F2",
    "Australia": "\U0001F1E6\U0001F1FA",
    "Austria": "\U0001F1E6\U0001F1F9",
    "Azerbaiyan": "\U0001F1E6\U0001F1FF",
    "Bangladesh": "\U0001F1E7\U0001F1E9",
    "Belgica": "\U0001F1E7\U0001F1EA",
    "Bielorrusia": "\U0001F1E7\U0001F1FE",
    "Bolivia": "\U0001F1E7\U0001F1F4",
    "Bosnia": "\U0001F1E7\U0001F1E6",
    "Brasil": "\U0001F1E7\U0001F1F7",
    "Bulgaria": "\U0001F1E7\U0001F1EC",
    "Canada": "\U0001F1E8\U0001F1E6",
    "Chile": "\U0001F1E8\U0001F1F1",
    "China": "\U0001F1E8\U0001F1F3",
    "Colombia": "\U0001F1E8\U0001F1F4",
    "Corea del Sur": "\U0001F1F0\U0001F1F7",
    "Costa Rica": "\U0001F1E8\U0001F1F7",
    "Croacia": "\U0001F1ED\U0001F1F7",
    "Cuba": "\U0001F1E8\U0001F1FA",
    "Dinamarca": "\U0001F1E9\U0001F1F0",
    "Ecuador": "\U0001F1EA\U0001F1E8",
    "Egipto": "\U0001F1EA\U0001F1EC",
    "El Salvador": "\U0001F1F8\U0001F1FB",
    "Eslovaquia": "\U0001F1F8\U0001F1F0",
    "Eslovenia": "\U0001F1F8\U0001F1EE",
    "Espana": "\U0001F1EA\U0001F1F8",
    "Estados Unidos": "\U0001F1FA\U0001F1F8",
    "Estonia": "\U0001F1EA\U0001F1EA",
    "Filipinas": "\U0001F1F5\U0001F1ED",
    "Finlandia": "\U0001F1EB\U0001F1EE",
    "Francia": "\U0001F1EB\U0001F1F7",
    "Georgia": "\U0001F1EC\U0001F1EA",
    "Grecia": "\U0001F1EC\U0001F1F7",
    "Guatemala": "\U0001F1EC\U0001F1F9",
    "Honduras": "\U0001F1ED\U0001F1F3",
    "Hungria": "\U0001F1ED\U0001F1FA",
    "India": "\U0001F1EE\U0001F1F3",
    "Indonesia": "\U0001F1EE\U0001F1E9",
    "Irak": "\U0001F1EE\U0001F1F6",
    "Iran": "\U0001F1EE\U0001F1F7",
    "Irlanda": "\U0001F1EE\U0001F1EA",
    "Islandia": "\U0001F1EE\U0001F1F8",
    "Israel": "\U0001F1EE\U0001F1F1",
    "Italia": "\U0001F1EE\U0001F1F9",
    "Jamaica": "\U0001F1EF\U0001F1F2",
    "Japon": "\U0001F1EF\U0001F1F5",
    "Kazajistan": "\U0001F1F0\U0001F1FF",
    "Kenia": "\U0001F1F0\U0001F1EA",
    "Letonia": "\U0001F1F1\U0001F1FB",
    "Libano": "\U0001F1F1\U0001F1E7",
    "Lituania": "\U0001F1F1\U0001F1F9",
    "Luxemburgo": "\U0001F1F1\U0001F1FA",
    "Malasia": "\U0001F1F2\U0001F1FE",
    "Marruecos": "\U0001F1F2\U0001F1E6",
    "Mexico": "\U0001F1F2\U0001F1FD",
    "Mongolia": "\U0001F1F2\U0001F1F3",
    "Myanmar": "\U0001F1F2\U0001F1F2",
    "Nepal": "\U0001F1F3\U0001F1F5",
    "Nicaragua": "\U0001F1F3\U0001F1EE",
    "Nigeria": "\U0001F1F3\U0001F1EC",
    "Noruega": "\U0001F1F3\U0001F1F4",
    "Nueva Zelanda": "\U0001F1F3\U0001F1FF",
    "Paises Bajos": "\U0001F1F3\U0001F1F1",
    "Pakistan": "\U0001F1F5\U0001F1F0",
    "Panama": "\U0001F1F5\U0001F1E6",
    "Paraguay": "\U0001F1F5\U0001F1FE",
    "Peru": "\U0001F1F5\U0001F1EA",
    "Polonia": "\U0001F1F5\U0001F1F1",
    "Portugal": "\U0001F1F5\U0001F1F9",
    "Puerto Rico": "\U0001F1F5\U0001F1F7",
    "Reino Unido": "\U0001F1EC\U0001F1E7",
    "Republica Checa": "\U0001F1E8\U0001F1FF",
    "Republica Dominicana": "\U0001F1E9\U0001F1F4",
    "Rumania": "\U0001F1F7\U0001F1F4",
    "Rusia": "\U0001F1F7\U0001F1FA",
    "Serbia": "\U0001F1F7\U0001F1F8",
    "Singapur": "\U0001F1F8\U0001F1EC",
    "Sri Lanka": "\U0001F1F1\U0001F1F0",
    "Sudafrica": "\U0001F1FF\U0001F1E6",
    "Suecia": "\U0001F1F8\U0001F1EA",
    "Suiza": "\U0001F1E8\U0001F1ED",
    "Tailandia": "\U0001F1F9\U0001F1ED",
    "Taiwan": "\U0001F1F9\U0001F1FC",
    "Trinidad y Tobago": "\U0001F1F9\U0001F1F9",
    "Tunez": "\U0001F1F9\U0001F1F3",
    "Turquia": "\U0001F1F9\U0001F1F7",
    "Ucrania": "\U0001F1FA\U0001F1E6",
    "Uruguay": "\U0001F1FA\U0001F1FE",
    "Uzbekistan": "\U0001F1FA\U0001F1FF",
    "Venezuela": "\U0001F1FB\U0001F1EA",
    "Vietnam": "\U0001F1FB\U0001F1F3",
}


class MetalArchiveState(rx.State):
    """State for Metal Archive section."""

    # Landing page
    featured_albums: list[dict] = []
    latest_albums: list[dict] = []
    genre_counts: list[dict] = []
    country_counts: list[dict] = []
    year_counts: list[dict] = []

    # Landing page stats (top 10 + totals)
    top_genre_counts: list[dict] = []
    top_country_counts: list[dict] = []
    top_year_counts: list[dict] = []
    total_albums: int = 0
    total_genres: int = 0
    total_countries: int = 0

    # Landing page "Ver todos" toggles
    show_all_genres: bool = False
    show_all_countries: bool = False
    show_all_years: bool = False

    # Landing live search
    live_search_query: str = ""
    live_search_results: list[dict] = []
    live_search_open: bool = False

    # Navigation: stores pending filter to apply on browse page load
    _pending_browse_filter: dict = {}

    # Browse / search
    albums: list[dict] = []
    search_query: str = ""
    filter_genre: str = ""
    filter_country: str = ""
    filter_year: str = ""
    filter_release_type: str = ""
    sort_order: str = "newest"
    page_offset: int = 0
    page_limit: int = 12
    has_more: bool = False

    # Album detail
    current_album: dict = {}
    current_tracks: list[dict] = []
    current_similar_bands: list[str] = []
    similar_albums: list[dict] = []

    # Filter options (populated from DB)
    available_genres: list[str] = []
    available_countries: list[str] = []
    available_years: list[str] = []
    available_release_types: list[str] = []

    # Cache flag: skip reloading filter options if already loaded
    _filter_options_loaded: bool = False

    @rx.var
    def genre_options(self) -> list[str]:
        return ["Todos los generos"] + self.available_genres

    @rx.var
    def country_options(self) -> list[str]:
        return ["Todos los paises"] + self.available_countries

    @rx.var
    def year_options(self) -> list[str]:
        return ["Todos los anos"] + self.available_years

    @rx.var
    def release_type_options(self) -> list[str]:
        return ["Todos los tipos"] + self.available_release_types

    def _album_to_dict(self, album: Album) -> dict:
        return {
            "id": album.id,
            "band_name": album.band_name,
            "album_title": album.album_title,
            "year": album.year,
            "country": album.country,
            "genre": album.genre,
            "release_type": album.release_type,
            "youtube_video_id": album.youtube_video_id,
            "youtube_url": album.youtube_url,
            "spotify_url": album.spotify_url,
            "bandcamp_url": album.bandcamp_url,
            "apple_music_url": album.apple_music_url,
            "metal_archives_url": album.metal_archives_url,
            "facebook_url": album.facebook_url,
            "instagram_url": album.instagram_url,
            "album_artwork_url": album.album_artwork_url,
            "description": album.description,
            "duration_minutes": album.duration_minutes or 0,
            "views": album.views,
            "featured": album.featured,
        }

    def _load_filter_options(self, session, force: bool = False):
        if self._filter_options_loaded and not force:
            return

        genres = session.exec(
            select(Album.genre).distinct().order_by(Album.genre)
        ).all()
        self.available_genres = [g for g in genres if g]

        countries = session.exec(
            select(Album.country).distinct().order_by(Album.country)
        ).all()
        self.available_countries = [c for c in countries if c]

        years = session.exec(
            select(Album.year).distinct().order_by(col(Album.year).desc())
        ).all()
        self.available_years = [str(y) for y in years if y]

        release_types = session.exec(
            select(Album.release_type).distinct().order_by(Album.release_type)
        ).all()
        self.available_release_types = [rt for rt in release_types if rt]

        self._filter_options_loaded = True

    def invalidate_filter_cache(self):
        """Invalidate cached filter options (call after sync)."""
        self._filter_options_loaded = False

    def _fetch_albums(self, session, append: bool = False):
        query = select(Album)

        if self.search_query:
            pattern = f"%{self.search_query}%"
            query = query.where(
                (col(Album.band_name).ilike(pattern))
                | (col(Album.album_title).ilike(pattern))
                | (col(Album.genre).ilike(pattern))
            )

        if self.filter_genre:
            query = query.where(Album.genre == self.filter_genre)
        if self.filter_country:
            query = query.where(Album.country == self.filter_country)
        if self.filter_year:
            query = query.where(Album.year == int(self.filter_year))
        if self.filter_release_type:
            query = query.where(Album.release_type == self.filter_release_type)

        if self.sort_order == "newest":
            query = query.order_by(col(Album.upload_date).desc())
        elif self.sort_order == "oldest":
            query = query.order_by(col(Album.upload_date).asc())
        elif self.sort_order == "az":
            query = query.order_by(Album.band_name.asc())
        elif self.sort_order == "za":
            query = query.order_by(Album.band_name.desc())
        elif self.sort_order == "views":
            query = query.order_by(col(Album.views).desc())

        query = query.offset(self.page_offset).limit(self.page_limit + 1)
        results = session.exec(query).all()

        if len(results) > self.page_limit:
            self.has_more = True
            results = results[: self.page_limit]
        else:
            self.has_more = False

        album_dicts = [self._album_to_dict(a) for a in results]
        if append:
            self.albums = self.albums + album_dicts
        else:
            self.albums = album_dicts

    @rx.event
    def load_landing_page(self):
        with rx.session() as session:
            self._load_filter_options(session)

            featured = session.exec(
                select(Album)
                .where(Album.featured == True)
                .order_by(col(Album.upload_date).desc())
                .limit(10)
            ).all()
            self.featured_albums = [self._album_to_dict(a) for a in featured]

            latest = session.exec(
                select(Album)
                .order_by(col(Album.upload_date).desc())
                .limit(12)
            ).all()
            self.latest_albums = [self._album_to_dict(a) for a in latest]

            # Total albums
            total_row = session.exec(
                select(func.count(Album.id))
            ).one()
            self.total_albums = total_row

            # Genre counts (all for browse filters)
            genre_rows = session.exec(
                select(Album.genre, func.count(Album.id))
                .where(Album.genre != "")
                .group_by(Album.genre)
                .order_by(func.count(Album.id).desc())
            ).all()
            self.genre_counts = [
                {"genre": row[0], "count": row[1]} for row in genre_rows if row[0]
            ]
            self.total_genres = len(self.genre_counts)

            # Top 10 genres for landing
            self.top_genre_counts = self.genre_counts[:10]

            # Country counts (all for browse filters)
            country_rows = session.exec(
                select(Album.country, func.count(Album.id))
                .where(Album.country != "")
                .group_by(Album.country)
                .order_by(func.count(Album.id).desc())
            ).all()
            self.country_counts = [
                {
                    "country": row[0],
                    "count": row[1],
                    "flag": COUNTRY_FLAGS.get(row[0], ""),
                }
                for row in country_rows if row[0]
            ]
            self.total_countries = len(self.country_counts)

            # Top 10 countries for landing
            self.top_country_counts = self.country_counts[:10]

            # Year counts
            year_rows = session.exec(
                select(Album.year, func.count(Album.id))
                .where(Album.year > 0)
                .group_by(Album.year)
                .order_by(col(Album.year).desc())
            ).all()
            self.year_counts = [
                {"year": row[0], "count": row[1]} for row in year_rows if row[0]
            ]
            # Top years: only those with 5+ albums
            self.top_year_counts = [
                yc for yc in self.year_counts if yc["count"] >= 5
            ]

    @rx.event
    def toggle_all_genres(self):
        self.show_all_genres = not self.show_all_genres

    @rx.event
    def toggle_all_countries(self):
        self.show_all_countries = not self.show_all_countries

    @rx.event
    def toggle_all_years(self):
        self.show_all_years = not self.show_all_years

    # ─── Live search ──────────────────────────────────────────────────

    @rx.event
    def on_live_search(self, value: str):
        """Search as user types, show results in dropdown."""
        self.live_search_query = value
        if len(value) < 2:
            self.live_search_results = []
            self.live_search_open = False
            return
        self.live_search_open = True
        with rx.session() as session:
            pattern = f"%{value}%"
            results = session.exec(
                select(Album)
                .where(
                    (col(Album.band_name).ilike(pattern))
                    | (col(Album.album_title).ilike(pattern))
                    | (col(Album.genre).ilike(pattern))
                )
                .order_by(col(Album.views).desc())
                .limit(8)
            ).all()
            self.live_search_results = [self._album_to_dict(a) for a in results]

    @rx.event
    def close_live_search(self):
        self.live_search_open = False
        self.live_search_results = []
        self.live_search_query = ""

    # ─── Navigate to browse with filter ───────────────────────────────

    @rx.event
    def navigate_to_genre(self, genre: str):
        self._pending_browse_filter = {"genre": genre}
        return rx.redirect("/metal-archive/browse")

    @rx.event
    def navigate_to_country(self, country: str):
        self._pending_browse_filter = {"country": country}
        return rx.redirect("/metal-archive/browse")

    @rx.event
    def navigate_to_year(self, year: int):
        self._pending_browse_filter = {"year": str(year)}
        return rx.redirect("/metal-archive/browse")

    @rx.var
    def visible_genre_counts(self) -> list[dict]:
        if self.show_all_genres:
            return self.genre_counts
        return self.top_genre_counts

    @rx.var
    def visible_country_counts(self) -> list[dict]:
        if self.show_all_countries:
            return self.country_counts
        return self.top_country_counts

    @rx.var
    def visible_year_counts(self) -> list[dict]:
        if self.show_all_years:
            return self.year_counts
        return self.top_year_counts

    @rx.event
    def load_browse_page(self):
        pending = self._pending_browse_filter
        self._pending_browse_filter = {}

        self.page_offset = 0
        self.search_query = ""
        self.sort_order = "newest"

        if pending:
            self.filter_genre = pending.get("genre", "")
            self.filter_country = pending.get("country", "")
            self.filter_year = pending.get("year", "")
            self.filter_release_type = ""
        else:
            self.filter_genre = ""
            self.filter_country = ""
            self.filter_year = ""
            self.filter_release_type = ""

        with rx.session() as session:
            self._load_filter_options(session)
            self._fetch_albums(session)

    @rx.event
    def load_album_detail(self):
        album_id_str = self.router.page.params.get("id", "")
        if not album_id_str:
            self.current_album = {}
            return
        try:
            album_id = int(album_id_str)
        except ValueError:
            self.current_album = {}
            return

        with rx.session() as session:
            album = session.get(Album, album_id)
            if not album:
                self.current_album = {}
                self.current_tracks = []
                self.current_similar_bands = []
                self.similar_albums = []
                return

            self.current_album = self._album_to_dict(album)

            tracks = session.exec(
                select(Track)
                .where(Track.album_id == album_id)
                .order_by(Track.track_number)
            ).all()
            self.current_tracks = [
                {
                    "track_number": t.track_number,
                    "track_name": t.track_name,
                    "timestamp": t.timestamp,
                }
                for t in tracks
            ]

            similar = session.exec(
                select(SimilarBand).where(SimilarBand.album_id == album_id)
            ).all()
            self.current_similar_bands = [s.similar_band_name for s in similar]

            # Similar albums: same genre, ordered by views
            similar_albums = session.exec(
                select(Album)
                .where(Album.genre == album.genre)
                .where(Album.id != album_id)
                .order_by(col(Album.views).desc())
                .limit(4)
            ).all()
            self.similar_albums = [self._album_to_dict(a) for a in similar_albums]

    @rx.event
    def load_genre_page(self):
        genre = self.router.page.params.get("genre", "")
        if not genre:
            return rx.redirect("/metal-archive/browse")
        self.filter_genre = genre
        self.filter_country = ""
        self.filter_year = ""
        self.filter_release_type = ""
        self.search_query = ""
        self.page_offset = 0
        self.sort_order = "newest"
        with rx.session() as session:
            self._load_filter_options(session)
            self._fetch_albums(session)

    @rx.event
    def load_country_page(self):
        country = self.router.page.params.get("country", "")
        if not country:
            return rx.redirect("/metal-archive/browse")
        self.filter_country = country
        self.filter_genre = ""
        self.filter_year = ""
        self.filter_release_type = ""
        self.search_query = ""
        self.page_offset = 0
        self.sort_order = "newest"
        with rx.session() as session:
            self._load_filter_options(session)
            self._fetch_albums(session)

    @rx.event
    def load_year_page(self):
        year = self.router.page.params.get("year", "")
        if not year:
            return rx.redirect("/metal-archive/browse")
        try:
            int(year)
        except ValueError:
            return rx.redirect("/metal-archive/browse")
        self.filter_year = year
        self.filter_genre = ""
        self.filter_country = ""
        self.filter_release_type = ""
        self.search_query = ""
        self.page_offset = 0
        self.sort_order = "newest"
        with rx.session() as session:
            self._load_filter_options(session)
            self._fetch_albums(session)

    @rx.event
    def set_search_query(self, value: str):
        self.search_query = value

    @rx.event
    def set_filter_genre(self, value: str):
        self.filter_genre = value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_country(self, value: str):
        self.filter_country = value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_year(self, value: str):
        self.filter_year = value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_sort_order(self, value: str):
        self.sort_order = value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_genre_option(self, value: str):
        """Handle genre select change (maps 'Todos los generos' to empty)."""
        self.filter_genre = "" if value == "Todos los generos" else value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_country_option(self, value: str):
        """Handle country select change (maps 'Todos los paises' to empty)."""
        self.filter_country = "" if value == "Todos los paises" else value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_year_option(self, value: str):
        """Handle year select change (maps 'Todos los anos' to empty)."""
        self.filter_year = "" if value == "Todos los anos" else value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_filter_release_type_option(self, value: str):
        """Handle release type select change (maps 'Todos los tipos' to empty)."""
        self.filter_release_type = "" if value == "Todos los tipos" else value
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def set_sort_option(self, value: str):
        """Handle sort select change (maps display labels to sort keys)."""
        mapping = {
            "Mas recientes": "newest",
            "Mas antiguos": "oldest",
            "A - Z": "az",
            "Z - A": "za",
            "Mas vistos": "views",
        }
        self.sort_order = mapping.get(value, "newest")
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def random_filters(self):
        """Set one random filter (genre OR country) to guarantee results."""
        self.filter_genre = ""
        self.filter_country = ""
        self.filter_year = ""
        self.filter_release_type = ""
        self.sort_order = "newest"
        # Pick one random filter type to apply
        choice = random.choice(["genre", "country"])
        if choice == "genre" and self.available_genres:
            self.filter_genre = random.choice(self.available_genres)
        elif choice == "country" and self.available_countries:
            self.filter_country = random.choice(self.available_countries)
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def search_albums(self):
        self.page_offset = 0
        with rx.session() as session:
            self._fetch_albums(session)

    @rx.event
    def load_more_albums(self):
        self.page_offset = self.page_offset + self.page_limit
        with rx.session() as session:
            self._fetch_albums(session, append=True)
