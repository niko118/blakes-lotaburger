/**
 * Shared page layout styles for admin pages
 *
 * Use these constants to maintain consistency across admin pages.
 * Import specific styles rather than the whole object when possible.
 */

export const adminPageStyles = {
  // Page container
  pageContainer: "space-y-6",

  // Header section with title and action button
  headerSection: "flex items-center justify-between",
  titleSection: "space-y-1",

  // Action buttons in header
  addButton: "h-9",
  addButtonIcon: "h-4 w-4 mr-2",

  // Search section
  searchSection: "flex items-center gap-4",
  searchInputContainer: "relative flex-1 max-w-sm",
  searchInput: "pl-10",
  searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver",

  // Table card container
  tableCard: "bg-white border-cloud",
  cardContent: "p-6",
} as const;

export type AdminPageStyles = typeof adminPageStyles;
