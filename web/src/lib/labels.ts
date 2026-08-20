// Display-label layer — the SINGLE source of truth for turning a raw database
// value into the text the visitor actually reads.
//
// WHY THIS FILE EXISTS
// The `albums.country` column stores SPANISH country names ("Estados Unidos",
// "Alemania", "Japon") because that is what the YouTube sync scripts write. The
// site is in English, so every place that renders a country must translate it.
// Before this file the flag map was COPY-PASTED into two pages, both keyed on
// the Spanish names — a drift bomb. Same lesson as slugify() in db.ts: one map,
// imported everywhere. `albums.genre` has the same problem on a much smaller
// scale (one Spanish placeholder value), handled by genreLabel() below.
//
// WHAT THIS FILE DOES *NOT* DO
// It never touches slugs. URL paths are still generated from the RAW database
// value via slugify(), so /metal-archive/country/estados-unidos keeps working
// and no inbound link breaks. Only the visible label and flag are translated.
//
// DATA QUALITY NOTE
// The column also holds a handful of malformed values: ISO long forms
// ("Iran, Islamic Republic of"), accent duplicates ("Hungria" vs "Hungría"),
// and outright junk ("Heavy Metal", "Western Europe"). The long forms and
// duplicates are mapped here so visitors at least read a clean name; the junk
// passes through untouched because it needs a database fix, not a translation.
// Those duplicates still generate SEPARATE facet pages — normalizing
// albums.country is the real fix (see scripts/normalize_db.py).

export interface CountryInfo {
  /** Flag emoji, or '' when there is no sensible flag. */
  flag: string;
  /** English display name. */
  en: string;
}

/**
 * Spanish (database) name -> { flag, English name }.
 * Keys MUST match the raw `albums.country` values exactly.
 */
const COUNTRIES: Record<string, CountryInfo> = {
  "Alemania":              { flag: "🇩🇪", en: "Germany" },
  "Arabia Saudita":        { flag: "🇸🇦", en: "Saudi Arabia" },
  "Argelia":               { flag: "🇩🇿", en: "Algeria" },
  "Argentina":             { flag: "🇦🇷", en: "Argentina" },
  "Armenia":               { flag: "🇦🇲", en: "Armenia" },
  "Australia":             { flag: "🇦🇺", en: "Australia" },
  "Austria":               { flag: "🇦🇹", en: "Austria" },
  "Azerbaiyan":            { flag: "🇦🇿", en: "Azerbaijan" },
  "Bangladesh":            { flag: "🇧🇩", en: "Bangladesh" },
  "Belgica":               { flag: "🇧🇪", en: "Belgium" },
  "Bielorrusia":           { flag: "🇧🇾", en: "Belarus" },
  "Bolivia":               { flag: "🇧🇴", en: "Bolivia" },
  "Bosnia":                { flag: "🇧🇦", en: "Bosnia and Herzegovina" },
  "Brasil":                { flag: "🇧🇷", en: "Brazil" },
  "Bulgaria":              { flag: "🇧🇬", en: "Bulgaria" },
  "Canada":                { flag: "🇨🇦", en: "Canada" },
  "Chile":                 { flag: "🇨🇱", en: "Chile" },
  "China":                 { flag: "🇨🇳", en: "China" },
  "Colombia":              { flag: "🇨🇴", en: "Colombia" },
  "Corea del Sur":         { flag: "🇰🇷", en: "South Korea" },
  "Costa Rica":            { flag: "🇨🇷", en: "Costa Rica" },
  "Croacia":               { flag: "🇭🇷", en: "Croatia" },
  "Cuba":                  { flag: "🇨🇺", en: "Cuba" },
  "Dinamarca":             { flag: "🇩🇰", en: "Denmark" },
  "Ecuador":               { flag: "🇪🇨", en: "Ecuador" },
  "Egipto":                { flag: "🇪🇬", en: "Egypt" },
  "El Salvador":           { flag: "🇸🇻", en: "El Salvador" },
  "Eslovaquia":            { flag: "🇸🇰", en: "Slovakia" },
  "Eslovenia":             { flag: "🇸🇮", en: "Slovenia" },
  "Espana":                { flag: "🇪🇸", en: "Spain" },
  "Estados Unidos":        { flag: "🇺🇸", en: "United States" },
  "Estonia":               { flag: "🇪🇪", en: "Estonia" },
  "Filipinas":             { flag: "🇵🇭", en: "Philippines" },
  "Finlandia":             { flag: "🇫🇮", en: "Finland" },
  "Francia":               { flag: "🇫🇷", en: "France" },
  "Georgia":               { flag: "🇬🇪", en: "Georgia" },
  "Grecia":                { flag: "🇬🇷", en: "Greece" },
  "Guatemala":             { flag: "🇬🇹", en: "Guatemala" },
  "Honduras":              { flag: "🇭🇳", en: "Honduras" },
  "Hungria":               { flag: "🇭🇺", en: "Hungary" },
  "Hungría":               { flag: "🇭🇺", en: "Hungary" },
  "India":                 { flag: "🇮🇳", en: "India" },
  "Indonesia":             { flag: "🇮🇩", en: "Indonesia" },
  "Irak":                  { flag: "🇮🇶", en: "Iraq" },
  "Iran":                  { flag: "🇮🇷", en: "Iran" },
  "Irlanda":               { flag: "🇮🇪", en: "Ireland" },
  "Islandia":              { flag: "🇮🇸", en: "Iceland" },
  "Israel":                { flag: "🇮🇱", en: "Israel" },
  "Italia":                { flag: "🇮🇹", en: "Italy" },
  "Jamaica":               { flag: "🇯🇲", en: "Jamaica" },
  "Japon":                 { flag: "🇯🇵", en: "Japan" },
  "Kazajistan":            { flag: "🇰🇿", en: "Kazakhstan" },
  "Kenia":                 { flag: "🇰🇪", en: "Kenya" },
  "Letonia":               { flag: "🇱🇻", en: "Latvia" },
  "Libano":                { flag: "🇱🇧", en: "Lebanon" },
  "Lituania":              { flag: "🇱🇹", en: "Lithuania" },
  "Luxemburgo":            { flag: "🇱🇺", en: "Luxembourg" },
  "Malasia":               { flag: "🇲🇾", en: "Malaysia" },
  "Malta":                 { flag: "🇲🇹", en: "Malta" },
  "Marruecos":             { flag: "🇲🇦", en: "Morocco" },
  "Mexico":                { flag: "🇲🇽", en: "Mexico" },
  "Mongolia":              { flag: "🇲🇳", en: "Mongolia" },
  "Myanmar":               { flag: "🇲🇲", en: "Myanmar" },
  "Nepal":                 { flag: "🇳🇵", en: "Nepal" },
  "Nicaragua":             { flag: "🇳🇮", en: "Nicaragua" },
  "Nigeria":               { flag: "🇳🇬", en: "Nigeria" },
  "Noruega":               { flag: "🇳🇴", en: "Norway" },
  "Nueva Zelanda":         { flag: "🇳🇿", en: "New Zealand" },
  "Paises Bajos":          { flag: "🇳🇱", en: "Netherlands" },
  "Pakistan":              { flag: "🇵🇰", en: "Pakistan" },
  "Panama":                { flag: "🇵🇦", en: "Panama" },
  "Paraguay":              { flag: "🇵🇾", en: "Paraguay" },
  "Peru":                  { flag: "🇵🇪", en: "Peru" },
  "Polonia":               { flag: "🇵🇱", en: "Poland" },
  "Portugal":              { flag: "🇵🇹", en: "Portugal" },
  "Puerto Rico":           { flag: "🇵🇷", en: "Puerto Rico" },
  "Reino Unido":           { flag: "🇬🇧", en: "United Kingdom" },
  "Republica Checa":       { flag: "🇨🇿", en: "Czech Republic" },
  "Republica Dominicana":  { flag: "🇩🇴", en: "Dominican Republic" },
  "Rumania":               { flag: "🇷🇴", en: "Romania" },
  "Rusia":                 { flag: "🇷🇺", en: "Russia" },
  "Serbia":                { flag: "🇷🇸", en: "Serbia" },
  "Singapur":              { flag: "🇸🇬", en: "Singapore" },
  "Sri Lanka":             { flag: "🇱🇰", en: "Sri Lanka" },
  "Sudafrica":             { flag: "🇿🇦", en: "South Africa" },
  "Suecia":                { flag: "🇸🇪", en: "Sweden" },
  "Suiza":                 { flag: "🇨🇭", en: "Switzerland" },
  "Tailandia":             { flag: "🇹🇭", en: "Thailand" },
  "Taiwan":                { flag: "🇹🇼", en: "Taiwan" },
  "Trinidad y Tobago":     { flag: "🇹🇹", en: "Trinidad and Tobago" },
  "Tunez":                 { flag: "🇹🇳", en: "Tunisia" },
  "Turquia":               { flag: "🇹🇷", en: "Turkey" },
  "Ucrania":               { flag: "🇺🇦", en: "Ukraine" },
  "Uruguay":               { flag: "🇺🇾", en: "Uruguay" },
  "Uzbekistan":            { flag: "🇺🇿", en: "Uzbekistan" },
  "Venezuela":             { flag: "🇻🇪", en: "Venezuela" },
  "Vietnam":               { flag: "🇻🇳", en: "Vietnam" },

  // ── Malformed values present in the database ──────────────────────────────
  // Mapped so visitors read a clean name. They remain distinct rows in the DB
  // and therefore still produce their own facet page — fix at the data layer.
  "Bolivia, Plurinational State of":   { flag: "🇧🇴", en: "Bolivia" },
  "Iran, Islamic Republic of":         { flag: "🇮🇷", en: "Iran" },
  "Syrian Arab Republic":              { flag: "🇸🇾", en: "Syria" },
  "Taiwan, Province of China":         { flag: "🇹🇼", en: "Taiwan" },
  "Venezuela, Bolivarian Republic of": { flag: "🇻🇪", en: "Venezuela" },
  "México (later)":                    { flag: "🇲🇽", en: "Mexico" },
};

/**
 * English display name for a raw database country value.
 * Unknown values pass through unchanged so nothing ever renders blank.
 */
export function countryLabel(value: string | null | undefined): string {
  if (!value) return '';
  return COUNTRIES[value]?.en ?? value;
}

/** Flag emoji for a raw database country value, or '' when unknown. */
export function countryFlag(value: string | null | undefined): string {
  if (!value) return '';
  return COUNTRIES[value]?.flag ?? '';
}

// ─── Genres ──────────────────────────────────────────────────────────────────
// `albums.genre` is otherwise already English ("Death Metal", "Grindcore"). The
// only Spanish value is a placeholder the sync wrote for albums with no genre —
// semantically identical to the 217 rows that are simply empty. Translating it
// here keeps the Browse dropdown English without touching the data or changing
// the genre page's URL. The real fix is normalizing those rows to '' in
// scripts/normalize_db.py, which would drop the junk facet page entirely.
const GENRES: Record<string, string> = {
  "Género desconocido": "Unknown genre",
};

/**
 * English display name for a raw database genre value.
 * Unknown values pass through unchanged — genres are already English.
 */
export function genreLabel(value: string | null | undefined): string {
  if (!value) return '';
  return GENRES[value] ?? value;
}
