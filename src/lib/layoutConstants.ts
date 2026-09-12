// Single source of truth for the compact (drawer) layout breakpoint. The CSS
// media queries in main-layout.css and editor.css must use the same value;
// layoutConstants.test.ts guards that parity.
export const COMPACT_LAYOUT_BREAKPOINT_PX = 900;

export const COMPACT_LAYOUT_MEDIA_QUERY = `(max-width: ${COMPACT_LAYOUT_BREAKPOINT_PX}px)`;
