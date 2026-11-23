# Brand and design system

**Direction:** Premium Minimal — Modern Healthcare Technology.

## Logo

An original monogram: two rounded pillars joined by a valley form an "M" that also reads as two things side by side — comparison, the core of the product — with a mint "insight" dot above. Files: `apps/mobile/assets/brand/mark.svg` (app icon), `mark-glyph.svg` (splash / adaptive foreground), `mark-mono.svg` (Android themed icon). The wordmark sets "Med" in charcoal and "Dexa" in forest/mint, Manrope ExtraBold, tight tracking. React component: `components/ui/Logo.tsx`.

## Colour tokens (`apps/mobile/src/theme/tokens.ts`)

| Token | Light | Dark |
| --- | --- | --- |
| primary | forest 800 `#0F3D2E` | mint 400 `#7FE0B5` |
| background | `#F6F7F5` (soft neutral) | `#090F0D` |
| surface | `#FFFFFF` | `#0D1513` |
| text | charcoal `#1C2321` | `#EEF3F0` |
| accent / success | forest 600 `#1B6A50` / mint tints | mint 400 |
| warning / danger / info | `#B7791F` / `#B4372B` / `#2F6F9F` with soft tints | lighter variants |

Demo data uses the warning tone everywhere so it is never mistaken for real data.

## Typography

Manrope (400–800). Scale: display 32, h1 26, h2 20, h3 17, body 15/22, small 13, caption 11 (uppercase, tracked), tabular numerals for prices and quantities. Font scaling is respected up to 1.6×.

## Components

`Text`, `Button` (primary, secondary, soft, ghost, danger, mint), `IconButton`, `Card`, `Badge`, `Chip`, `SearchBar`, `TextField`, `Segmented`, `Sheet` (bottom sheet), `ListRow`/`ListGroup`, `Skeleton`/`CardSkeleton`/`ListSkeleton`, `EmptyState`, `ErrorState` (network vs not found vs generic), `Stars`/`StarInput`, `VerificationBadge`, `ProvenanceLine`, `Toast`, `LogoMark`/`Wordmark`. Domain: `MedicineCard`, `IngredientList`, `CompareMatrix`, `AssessmentBanner`, `DifferenceList`, `PriceList`, `PharmacyCard`, `PharmacyMap`, `ReviewsBlock`.

Icons: Lucide (2 px stroke). Radii 8–28, generous 20 px screen gutters, subtle shadows only in light mode.

## Navigation

Five tabs — Home, Search, **Compare** (raised forest button with a live count badge), Pharmacies, Profile — plus stacked detail screens and modal sheets for sign-in, review writing, filters, sorting, language and currency.

## Admin

The dashboard reuses the palette (forest sidebar, mint accents, Manrope) with automatic dark mode, so the product feels like one brand across surfaces.
