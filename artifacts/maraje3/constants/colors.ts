/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17323a',
    tint: '#14756f',

    // Core surfaces
    background: '#f6f4ec',
    foreground: '#17323a',

    // Cards / elevated surfaces
    card: '#fffef9',
    cardForeground: '#17323a',

    // Primary action color (buttons, links, active states)
    primary: '#123f4a',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e6efeb',
    secondaryForeground: '#17323a',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eeeee7',
    mutedForeground: '#697b7c',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#d9ebe4',
    accentForeground: '#126b66',

    // Destructive actions (delete, error states)
    destructive: '#b84e45',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#dfe2d9',
    input: '#dfe2d9',
  },

  radius: 14,
};

export default colors;
