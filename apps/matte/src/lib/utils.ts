/**
 * Matte (Painting) Product Utilities
 *
 * This file contains painting-specific utilities and constants.
 * Core utilities (formatting, etc.) are imported from @drip/core
 */

// Re-export core utilities for convenience
export * from "@drip/core/utils";

// ============================================
// PAINTING-SPECIFIC CONSTANTS & UTILITIES
// ============================================

// Service types for painting jobs
export const SERVICE_TYPES = {
  sqft: ["interior_walls", "ceilings", "trim_doors"] as const,
  flat: ["cabinets", "prep_work", "repairs", "deck_fence", "touchups"] as const,
};

export const SERVICE_LABELS: Record<string, string> = {
  interior_walls: "Interior Walls",
  ceilings: "Ceilings",
  trim_doors: "Trim & Doors",
  cabinets: "Cabinets",
  prep_work: "Prep Work",
  repairs: "Repairs",
  deck_fence: "Deck / Fence",
  touchups: "Touch-ups",
};

// Default materials per painting service
export const SERVICE_MATERIALS: Record<string, string[]> = {
  interior_walls: ["Paint (gallons)", "Primer", "Rollers", "Brushes", "Tape", "Drop cloths"],
  ceilings: ["Ceiling paint", "Extension pole", "Rollers", "Tape"],
  trim_doors: ["Trim paint", "Brushes", "Sandpaper", "Tape"],
  cabinets: ["Cabinet paint", "Primer", "Brushes", "Sandpaper", "Degreaser"],
  prep_work: ["Spackle", "Sandpaper", "Caulk", "Primer"],
  repairs: ["Spackle", "Drywall patch", "Joint compound", "Sandpaper"],
  deck_fence: ["Stain/Paint", "Pressure washer", "Brushes", "Rollers"],
  touchups: ["Touch-up paint", "Small brushes", "Spackle"],
};

// Common painting materials for quick add
export const COMMON_MATERIALS = [
  "Paint (gallons)",
  "Primer",
  "Rollers",
  "Brushes",
  "Tape",
  "Drop cloths",
  "Spackle",
  "Sandpaper",
  "Caulk",
  "Extension pole",
  "Paint trays",
  "Stir sticks",
];

// Paint sheen options (expanded list)
export const PAINT_SHEENS = [
  "Flat",
  "Matte",
  "Eggshell",
  "Satin",
  "Semi-Gloss",
  "High-Gloss",
  "Gloss",
  "Pearl",
  "Velvet",
] as const;

export type PaintSheen = (typeof PAINT_SHEENS)[number];

// Theme options - Popular Sherwin-Williams colors (mix of neutrals and vibrant)
export const THEMES = [
  // Popular Neutrals
  { id: "agreeable-gray", name: "Agreeable Gray", color: "#d1ccc4", bgColor: "#f5f3f0" },
  { id: "repose-gray", name: "Repose Gray", color: "#c8c5be", bgColor: "#f0efeb" },
  { id: "alabaster", name: "Alabaster", color: "#f3ede5", bgColor: "#faf8f4" },

  // Vibrant Blues
  { id: "naval", name: "Naval", color: "#1f3a5f", bgColor: "#e8ecf1" },
  { id: "hale-navy", name: "Hale Navy", color: "#2d3a4b", bgColor: "#e4e8ed" },
  { id: "watery", name: "Watery", color: "#a4d4d4", bgColor: "#e8f2f2" },
  { id: "raindrops", name: "Raindrops", color: "#b1c4d4", bgColor: "#e8eff4" },

  // Vibrant Greens
  { id: "sea-salt", name: "Sea Salt", color: "#c5d4c5", bgColor: "#eef2ed" },
  { id: "evergreen-fog", name: "Evergreen Fog", color: "#95978a", bgColor: "#eef0ea" },
  { id: "jade-dragon", name: "Jade Dragon", color: "#5a7d5a", bgColor: "#e8ede8" },
  { id: "sage-green", name: "Sage Green", color: "#9caf88", bgColor: "#eef2eb" },

  // Warm Colors
  { id: "peppercorn", name: "Peppercorn", color: "#6c6c6c", bgColor: "#e8e8e8" },
  { id: "colonel-sanders", name: "Colonel Sanders", color: "#8b6f47", bgColor: "#f0ebe4" },
  { id: "copper-penny", name: "Copper Penny", color: "#ad6f69", bgColor: "#f2e8e7" },
  { id: "coral-reef", name: "Coral Reef", color: "#d9776b", bgColor: "#f5e8e5" },

  // Rich Darks
  { id: "iron-ore", name: "Iron Ore", color: "#434343", bgColor: "#e8e8e8" },
  { id: "urbane-bronze", name: "Urbane Bronze", color: "#54504a", bgColor: "#eae8e4" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
