# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal portfolio website built with **Reflex** (Python web framework) showcasing Daniel Banariba's work as a software developer and video editor. The site features links to social media, audiovisual projects (music videos), and contact information.

**Framework:** Reflex 0.8.17 (Python-based reactive web framework)
**Language:** Spanish (site content is in Spanish)

## Development Commands

### Environment Setup
```bash
# Activate virtual environment
source env/bin/activate

# Install/upgrade dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Initialize Reflex (first time setup)
reflex init
```

### Running the Application
```bash
# Development server with hot reload
reflex run

# Development server on specific host/port
reflex run --loglevel debug
```

### Building for Production
```bash
# Export frontend-only build
reflex export --frontend-only

# The build.sh script automates the full build process:
./build.sh
# This script: activates env, upgrades pip, installs requirements,
# initializes reflex, exports frontend, cleans up old public folder,
# unzips frontend, and deactivates env
```

## Architecture Overview

### Application Structure
The app follows a component-based architecture with clear separation:

```
links_bio/
├── links_bio.py          # Main app entry point, page configuration
├── views/                # Page-level compositions
│   ├── header.py         # Profile header with avatar, bio, social icons
│   └── links.py          # Main content area with video projects and contact
├── components/           # Reusable UI components
│   ├── navbar.py         # Sticky navigation with logo
│   ├── footer.py         # Footer with copyright
│   ├── link_button.py    # Standard link button (title, body, icon)
│   ├── link_video.py     # Video preview card component
│   ├── link_icon.py      # Social media icon links
│   ├── link_proyects.py  # Project preview component
│   ├── title.py          # Section title component
│   └── info_text.py      # Stat display component
├── styles/               # Centralized styling
│   ├── styles.py         # Size enum, base styles, component styles
│   ├── colors.py         # Color palette constants
│   └── fonts.py          # Font family and weight definitions
└── constants/
    ├── url_social.py     # Social media URLs and constants
    └── images.py         # Image paths constants
```

### Key Design Patterns

1. **Component Composition**: Main page (`index()`) composes high-level views (navbar, header, links, footer), which in turn compose reusable components.

2. **Centralized Styling**: All styles defined in `links_bio/styles/styles.py` with:
   - `Size` enum for consistent spacing/sizing (has two categories: spacing values 0-9 for HStack/VStack, and CSS values with units for other properties)
   - `BASE_STYLE` dict applies globally to all components
   - Named style dicts (e.g., `button_title_style`) for specific use cases

3. **Constants Management**:
   - URLs and configuration values in `links_bio/constants/url_social.py`
   - Image paths centralized in `links_bio/constants/images.py` for consistency and easy updates

4. **Dynamic Content**: Functions like `experiencePrograming()` and `experienceEditorVideo()` in `links_bio/views/header.py` calculate years of experience dynamically based on current date.

5. **Responsive Design**: Uses Reflex's responsive utilities:
   - `rx.mobile_only()` / `rx.tablet_and_desktop()` for conditional rendering
   - Components adjust layout based on screen size

### Main Entry Point
`links_bio/links_bio.py` is the application root:
- Configures the Reflex app with stylesheets, base styles
- Defines the `index()` page component
- Sets page metadata (title, description, og:image)
- Contains commented TODO for Google Analytics integration

## Important Notes

- **Virtual Environment**: Always activate the virtual environment (`source env/bin/activate`) before running commands
- **Python Version**: Project uses Python 3.14 (note: Pydantic v1 compatibility warning is expected)
- **Spanish Content**: All user-facing text is in Spanish
- **External Links**: All external links open in new tabs (`is_external=True`)
- **Assets**: Images/icons are referenced using constants from `links_bio/constants/images.py`
- **Sticky Navbar**: The navbar uses `position="sticky"` with `z_index="999"` to remain fixed at top
- **SEO**: Open Graph meta tags are injected via JavaScript in `links_bio.py:13-29`
- **Performance**: All images use `loading="lazy"` for optimized performance
- **Sitemap Plugin**: Disabled in `rxconfig.py` to avoid warnings
