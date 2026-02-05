import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPhone,
  generateToken,
  getInitials,
  slugify,
  generateSMSLink,
  validatePhoneNumber,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  SERVICE_TYPES,
  SERVICE_LABELS,
  SERVICE_MATERIALS,
  COMMON_MATERIALS,
  PAINT_SHEENS,
  THEMES,
} from "../utils";

// ─── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats cents to dollars correctly", () => {
    expect(formatCurrency(10000)).toBe("$100.00");
    expect(formatCurrency(999)).toBe("$9.99");
    expect(formatCurrency(50)).toBe("$0.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-$5.00");
  });

  it("handles large amounts", () => {
    expect(formatCurrency(1000000)).toBe("$10,000.00");
  });

  it("handles fractional cents by rounding", () => {
    // 1234 cents = $12.34
    expect(formatCurrency(1234)).toBe("$12.34");
  });

  it("handles single cent", () => {
    expect(formatCurrency(1)).toBe("$0.01");
  });
});

// ─── formatDate ─────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats Date objects", () => {
    const date = new Date(2026, 0, 12); // Jan 12, 2026
    const result = formatDate(date);
    expect(result).toContain("Jan");
    expect(result).toContain("12");
    expect(result).toContain("2026");
  });

  it("formats ISO date strings as local dates", () => {
    const result = formatDate("2026-01-12");
    expect(result).toContain("Jan");
    expect(result).toContain("12");
    expect(result).toContain("2026");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("");
  });

  it("handles full ISO datetime strings", () => {
    const result = formatDate("2026-06-15T14:30:00Z");
    expect(result).toContain("2026");
  });
});

// ─── formatTime ─────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats morning time correctly", () => {
    expect(formatTime("09:30")).toBe("9:30 AM");
  });

  it("formats afternoon time correctly", () => {
    expect(formatTime("14:00")).toBe("2:00 PM");
  });

  it("formats midnight correctly", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
  });

  it("formats noon correctly", () => {
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("formats 11 PM correctly", () => {
    expect(formatTime("23:45")).toBe("11:45 PM");
  });

  it("returns empty string for null", () => {
    expect(formatTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatTime(undefined)).toBe("");
  });

  it("returns empty string for invalid time strings", () => {
    expect(formatTime("abc")).toBe("");
    expect(formatTime("")).toBe("");
    expect(formatTime("::")).toBe("");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error testing runtime behavior
    expect(formatTime(123)).toBe("");
  });
});

// ─── formatPhone ────────────────────────────────────────────────────────────────

describe("formatPhone", () => {
  it("formats 10-digit phone numbers", () => {
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
  });

  it("formats phone numbers with existing formatting", () => {
    expect(formatPhone("(555) 123-4567")).toBe("(555) 123-4567");
  });

  it("formats phone numbers with dashes", () => {
    expect(formatPhone("555-123-4567")).toBe("(555) 123-4567");
  });

  it("returns original if not 10 digits after cleaning", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("123456789012")).toBe("123456789012");
  });

  it("handles phone numbers with country code prefix", () => {
    // 11 digits won't match the 10-digit format
    expect(formatPhone("15551234567")).toBe("15551234567");
  });
});

// ─── generateToken ──────────────────────────────────────────────────────────────

describe("generateToken", () => {
  it("generates a token of default length 32", () => {
    const token = generateToken();
    expect(token).toHaveLength(32);
  });

  it("generates a token of specified length", () => {
    expect(generateToken(10)).toHaveLength(10);
    expect(generateToken(64)).toHaveLength(64);
    expect(generateToken(1)).toHaveLength(1);
  });

  it("contains only alphanumeric characters", () => {
    const token = generateToken(100);
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

// ─── getInitials ────────────────────────────────────────────────────────────────

describe("getInitials", () => {
  it("returns first two initials of a full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns single initial for single name", () => {
    expect(getInitials("John")).toBe("J");
  });

  it("returns max two initials for long names", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("returns uppercase initials", () => {
    expect(getInitials("john doe")).toBe("JD");
  });
});

// ─── slugify ────────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts text to lowercase slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! World?")).toBe("hello-world");
  });

  it("replaces multiple spaces with single dash", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("removes leading and trailing dashes", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("handles already slugified text", () => {
    expect(slugify("hello-world")).toBe("hello-world");
  });

  it("handles underscores", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

// ─── generateSMSLink ───────────────────────────────────────────────────────────

describe("generateSMSLink", () => {
  it("generates correct SMS link format", () => {
    const link = generateSMSLink("555-123-4567", "Hello World");
    expect(link).toBe("sms:+5551234567?body=Hello%20World");
  });

  it("cleans phone number of non-digit characters", () => {
    const link = generateSMSLink("(555) 123-4567", "Hi");
    expect(link).toBe("sms:+5551234567?body=Hi");
  });

  it("encodes special characters in message", () => {
    const link = generateSMSLink("5551234567", "Hello & Goodbye!");
    expect(link).toContain("body=Hello%20%26%20Goodbye!");
  });

  it("handles empty message", () => {
    const link = generateSMSLink("5551234567", "");
    expect(link).toBe("sms:+5551234567?body=");
  });
});

// ─── validatePhoneNumber ────────────────────────────────────────────────────────

describe("validatePhoneNumber", () => {
  it("validates 10-digit phone number", () => {
    const result = validatePhoneNumber("5551234567");
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe("(555) 123-4567");
  });

  it("validates 11-digit number starting with 1", () => {
    const result = validatePhoneNumber("15551234567");
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe("+1 (555) 123-4567");
  });

  it("validates phone with formatting", () => {
    const result = validatePhoneNumber("(555) 123-4567");
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe("(555) 123-4567");
  });

  it("rejects empty phone number", () => {
    const result = validatePhoneNumber("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Phone number is required");
  });

  it("rejects too short phone number", () => {
    const result = validatePhoneNumber("12345");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Please enter a valid 10-digit US phone number");
  });

  it("rejects too long phone number", () => {
    const result = validatePhoneNumber("123456789012");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Please enter a valid 10-digit US phone number");
  });

  it("rejects 11-digit number not starting with 1", () => {
    const result = validatePhoneNumber("25551234567");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Please enter a valid 10-digit US phone number");
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────────

describe("JOB_STATUSES", () => {
  it("contains all expected statuses in order", () => {
    expect(JOB_STATUSES).toEqual([
      "new",
      "quoted",
      "scheduled",
      "in_progress",
      "done",
      "paid",
      "archive",
    ]);
  });

  it("has 7 statuses", () => {
    expect(JOB_STATUSES).toHaveLength(7);
  });
});

describe("JOB_STATUS_LABELS", () => {
  it("has labels for all statuses", () => {
    for (const status of JOB_STATUSES) {
      expect(JOB_STATUS_LABELS[status]).toBeDefined();
      expect(typeof JOB_STATUS_LABELS[status]).toBe("string");
    }
  });

  it("has correct specific labels", () => {
    expect(JOB_STATUS_LABELS.new).toBe("New");
    expect(JOB_STATUS_LABELS.in_progress).toBe("In Progress");
    expect(JOB_STATUS_LABELS.archive).toBe("Archive");
  });
});

describe("JOB_STATUS_COLORS", () => {
  it("has colors for all statuses", () => {
    for (const status of JOB_STATUSES) {
      expect(JOB_STATUS_COLORS[status]).toBeDefined();
      expect(JOB_STATUS_COLORS[status]).toContain("bg-");
      expect(JOB_STATUS_COLORS[status]).toContain("text-");
    }
  });
});

describe("SERVICE_TYPES", () => {
  it("has sqft and flat categories", () => {
    expect(SERVICE_TYPES.sqft).toBeDefined();
    expect(SERVICE_TYPES.flat).toBeDefined();
  });

  it("sqft includes interior_walls, ceilings, trim_doors", () => {
    expect(SERVICE_TYPES.sqft).toContain("interior_walls");
    expect(SERVICE_TYPES.sqft).toContain("ceilings");
    expect(SERVICE_TYPES.sqft).toContain("trim_doors");
  });

  it("flat includes cabinets, prep_work, repairs, deck_fence, touchups", () => {
    expect(SERVICE_TYPES.flat).toContain("cabinets");
    expect(SERVICE_TYPES.flat).toContain("prep_work");
    expect(SERVICE_TYPES.flat).toContain("repairs");
    expect(SERVICE_TYPES.flat).toContain("deck_fence");
    expect(SERVICE_TYPES.flat).toContain("touchups");
  });
});

describe("SERVICE_LABELS", () => {
  it("has labels for all sqft service types", () => {
    for (const type of SERVICE_TYPES.sqft) {
      expect(SERVICE_LABELS[type]).toBeDefined();
    }
  });

  it("has labels for all flat service types", () => {
    for (const type of SERVICE_TYPES.flat) {
      expect(SERVICE_LABELS[type]).toBeDefined();
    }
  });
});

describe("SERVICE_MATERIALS", () => {
  it("has materials for each service type", () => {
    const allTypes = [...SERVICE_TYPES.sqft, ...SERVICE_TYPES.flat];
    for (const type of allTypes) {
      expect(SERVICE_MATERIALS[type]).toBeDefined();
      expect(Array.isArray(SERVICE_MATERIALS[type])).toBe(true);
      expect(SERVICE_MATERIALS[type].length).toBeGreaterThan(0);
    }
  });

  it("interior_walls has paint-related materials", () => {
    expect(SERVICE_MATERIALS.interior_walls).toContain("Paint (gallons)");
    expect(SERVICE_MATERIALS.interior_walls).toContain("Primer");
    expect(SERVICE_MATERIALS.interior_walls).toContain("Rollers");
  });
});

describe("COMMON_MATERIALS", () => {
  it("is a non-empty array", () => {
    expect(COMMON_MATERIALS.length).toBeGreaterThan(0);
  });

  it("contains expected common materials", () => {
    expect(COMMON_MATERIALS).toContain("Paint (gallons)");
    expect(COMMON_MATERIALS).toContain("Primer");
    expect(COMMON_MATERIALS).toContain("Tape");
    expect(COMMON_MATERIALS).toContain("Drop cloths");
  });
});

describe("PAINT_SHEENS", () => {
  it("contains expected sheen options", () => {
    expect(PAINT_SHEENS).toContain("Flat");
    expect(PAINT_SHEENS).toContain("Matte");
    expect(PAINT_SHEENS).toContain("Eggshell");
    expect(PAINT_SHEENS).toContain("Satin");
    expect(PAINT_SHEENS).toContain("Semi-Gloss");
    expect(PAINT_SHEENS).toContain("High-Gloss");
  });

  it("has 9 sheen options", () => {
    expect(PAINT_SHEENS).toHaveLength(9);
  });
});

describe("THEMES", () => {
  it("is a non-empty array of theme objects", () => {
    expect(THEMES.length).toBeGreaterThan(0);
  });

  it("each theme has required properties", () => {
    for (const theme of THEMES) {
      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.color).toBeDefined();
      expect(theme.bgColor).toBeDefined();
      expect(theme.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("contains popular Sherwin-Williams colors", () => {
    const themeIds = THEMES.map((t) => t.id);
    expect(themeIds).toContain("agreeable-gray");
    expect(themeIds).toContain("naval");
    expect(themeIds).toContain("sea-salt");
    expect(themeIds).toContain("iron-ore");
  });

  it("all theme IDs are unique", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
