# ─── Metal Archive Routes ─────────────────────────────────────────────
METAL_ARCHIVE_HOME = "/metal-archive"
METAL_ARCHIVE_BROWSE = "/metal-archive/browse"
METAL_ARCHIVE_SUBMIT = "/metal-archive/submit"
METAL_ARCHIVE_PROMO = "/metal-archive/promo"
METAL_ARCHIVE_NEWSLETTER = "/metal-archive/newsletter"
METAL_ARCHIVE_ALBUM = "/metal-archive/album/[id]"
METAL_ARCHIVE_GENRE = "/metal-archive/genre/[genre]"
METAL_ARCHIVE_COUNTRY = "/metal-archive/country/[country]"
METAL_ARCHIVE_YEAR = "/metal-archive/year/[year]"

# ─── Page Metadata ────────────────────────────────────────────────────
META_TITLE = "Metal Archive | Daniel Banariba"
META_DESCRIPTION = "Archivo de metal underground hondureno. Videos musicales, bandas, albumes y mas."

# ─── Genres ───────────────────────────────────────────────────────────
GENRES = [
    "Death Metal",
    "Black Metal",
    "Thrash Metal",
    "Doom Metal",
    "Grindcore",
    "Power Metal",
    "Heavy Metal",
    "Death Metal Melodico",
    "Grind/Death Metal",
    "Punk Rock",
    "Metalcore",
    "Progressive Metal",
    "Folk Metal",
    "Symphonic Metal",
    "Sludge Metal",
    "Stoner Metal",
    "Speed Metal",
    "Brutal Death Metal",
]

# ─── Sort Options ─────────────────────────────────────────────────────
SORT_OPTIONS = [
    ("newest", "Mas recientes"),
    ("oldest", "Mas antiguos"),
    ("az", "A - Z"),
    ("za", "Z - A"),
    ("views", "Mas vistos"),
]

# ─── Promo Packages ──────────────────────────────────────────────────
PROMO_PACKAGES = [
    {
        "name": "Basico",
        "price": "Gratis",
        "features": [
            "Publicacion en el archivo",
            "Miniatura personalizada",
            "Descripcion del album",
        ],
    },
    {
        "name": "Profesional",
        "price": "Contactar",
        "features": [
            "Todo lo del plan Basico",
            "Video musical completo",
            "Promocion en redes sociales",
            "Estreno programado en YouTube",
        ],
    },
    {
        "name": "Premium",
        "price": "Contactar",
        "features": [
            "Todo lo del plan Profesional",
            "Sesion de fotos / video",
            "Documental corto de la banda",
            "Cobertura de evento en vivo",
            "Contenido exclusivo para redes",
        ],
    },
]
