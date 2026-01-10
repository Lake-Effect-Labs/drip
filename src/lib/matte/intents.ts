// Intent classification for Matte AI Assistant
// Maps user questions to specific data queries

export type MatteIntent =
  // Existing specific intents (for backward compatibility)
  | "UNPAID_INVOICES"
  | "OVERDUE_INVOICES"
  | "PAYMENTS_THIS_WEEK"
  | "JOBS_TODAY"
  | "JOBS_TOMORROW"
  | "JOBS_IN_PROGRESS"
  | "STUCK_JOBS"
  | "MATERIALS_TODAY"
  | "MATERIALS_TOMORROW"
  | "JOBS_MISSING_MATERIALS"
  | "FOCUS_TODAY"
  | "GENERAL_SUMMARY"
  | "TOTAL_JOBS"
  | "TOTAL_REVENUE"
  | "JOBS_THIS_WEEK"
  | "ACTIVE_JOBS"
  | "JOBS_BY_STATUS"
  // New flexible intents (for entity-based queries)
  | "JOB_LOOKUP"
  | "ESTIMATE_LOOKUP"
  | "INVOICE_LOOKUP"
  | "CUSTOMER_LOOKUP"
  | "MATERIAL_LOOKUP"
  | "RELATIONSHIP_QUERY"
  | "OUT_OF_SCOPE";

// Entity detection results
export interface DetectedEntities {
  jobIdentifier?: string; // Job name, customer name, or address keyword
  customerName?: string;
  dateRange?: { start: Date; end: Date } | "today" | "tomorrow" | "this_week" | "last_month";
  dataType?: "jobs" | "estimates" | "invoices" | "materials" | "paint" | "customers" | "payments";
  relationship?: "accepted_no_invoice" | "unpaid" | "overdue";
}

interface IntentPattern {
  intent: MatteIntent;
  keywords: string[];
  patterns: RegExp[];
}

const intentPatterns: IntentPattern[] = [
  // Date-specific queries first (more specific)
  {
    intent: "JOBS_TODAY",
    keywords: ["jobs today", "today's jobs", "scheduled today", "what do i have today", "how many jobs today"],
    patterns: [
      /how.*many.*job.*today/i,
      /job.*today/i,
      /today.*job/i,
      /what.*today/i,
      /scheduled.*today/i,
      /have.*today/i,
    ],
  },
  {
    intent: "JOBS_TOMORROW",
    keywords: ["jobs tomorrow", "tomorrow's jobs", "scheduled tomorrow"],
    patterns: [/job.*tomorrow/i, /tomorrow.*job/i, /scheduled.*tomorrow/i],
  },
  {
    intent: "MATERIALS_TODAY",
    keywords: ["materials today", "need today", "paint today", "what materials do i need", "what materials", "materials i need"],
    patterns: [
      /what.*material.*need/i,
      /material.*need/i,
      /need.*material/i,
      /material.*today/i,
      /need.*today/i,
      /paint.*today/i,
    ],
  },
  {
    intent: "MATERIALS_TOMORROW",
    keywords: ["materials tomorrow", "need tomorrow", "paint tomorrow"],
    patterns: [/material.*tomorrow/i, /need.*tomorrow/i, /paint.*tomorrow/i],
  },
  {
    intent: "PAYMENTS_THIS_WEEK",
    keywords: ["payments this week", "paid this week", "received this week"],
    patterns: [/payment.*this.*week/i, /paid.*this.*week/i, /received.*this.*week/i],
  },
  {
    intent: "JOBS_THIS_WEEK",
    keywords: ["jobs this week", "new jobs this week", "jobs added this week"],
    patterns: [/job.*this.*week/i, /new.*job.*this.*week/i, /job.*added.*this.*week/i],
  },
  // Payment queries
  {
    intent: "UNPAID_INVOICES",
    keywords: ["unpaid", "haven't paid", "hasn't paid", "not paid", "outstanding", "pending payment"],
    patterns: [
      /who.*(hasn't|has not|haven't|have not).*paid/i,
      /unpaid.*invoice/i,
      /who.*owe/i,
      /outstanding.*payment/i,
    ],
  },
  {
    intent: "OVERDUE_INVOICES",
    keywords: ["overdue", "late payment", "past due"],
    patterns: [/overdue/i, /late.*payment/i, /past.*due/i],
  },
  // Job status queries
  {
    intent: "JOBS_IN_PROGRESS",
    keywords: ["in progress", "active jobs", "working on"],
    patterns: [/in.*progress/i, /active.*job/i, /working.*on/i],
  },
  {
    intent: "STUCK_JOBS",
    keywords: ["stuck", "same status", "not moving", "haven't changed"],
    patterns: [/stuck/i, /same.*status/i, /not.*moving/i, /haven't.*changed/i],
  },
  {
    intent: "JOBS_MISSING_MATERIALS",
    keywords: ["missing materials", "no materials", "need materials"],
    patterns: [/missing.*material/i, /no.*material/i, /need.*material/i],
  },
  {
    intent: "FOCUS_TODAY",
    keywords: ["what should i work on", "focus today", "priority today", "what to do"],
    patterns: [
      /what.*should.*work/i,
      /focus.*today/i,
      /priority.*today/i,
      /what.*to.*do/i,
      /what.*do.*today/i,
    ],
  },
  // Dashboard/metrics queries (less specific, check after date-specific)
  {
    intent: "TOTAL_JOBS",
    keywords: ["total jobs", "how many jobs", "all jobs"],
    patterns: [/total.*job/i, /how.*many.*job(?!.*today|.*tomorrow|.*week)/i, /all.*job/i],
  },
  {
    intent: "ACTIVE_JOBS",
    keywords: ["active jobs", "how many active", "current jobs"],
    patterns: [/active.*job/i, /how.*many.*active/i, /current.*job/i],
  },
  {
    intent: "TOTAL_REVENUE",
    keywords: ["total revenue", "total invoiced", "how much revenue", "total money"],
    patterns: [/total.*revenue/i, /total.*invoiced/i, /how.*much.*revenue/i, /total.*money/i],
  },
  {
    intent: "JOBS_BY_STATUS",
    keywords: ["jobs by status", "how many scheduled", "how many in progress", "status breakdown"],
    patterns: [/job.*by.*status/i, /how.*many.*scheduled/i, /how.*many.*in.*progress/i, /status.*breakdown/i],
  },
  {
    intent: "GENERAL_SUMMARY",
    keywords: ["summary", "overview"],
    patterns: [/summary/i, /overview/i],
  },
  // New flexible intents
  {
    intent: "RELATIONSHIP_QUERY",
    keywords: ["accepted but no invoice", "estimate accepted no invoice", "not invoiced"],
    patterns: [
      /accepted.*(but|without|no).*invoice/i,
      /estimate.*(but|without|no).*invoice/i,
      /not.*invoiced/i,
    ],
  },
  {
    intent: "CUSTOMER_LOOKUP",
    keywords: ["which customers owe", "customers haven't paid", "customers unpaid"],
    patterns: [/which.*customer.*owe/i, /customer.*(unpaid|haven't paid|owe)/i],
  },
];

export function classifyIntent(userInput: string): MatteIntent {
  const normalized = userInput.toLowerCase().trim();

  // Check patterns first (more specific)
  for (const { intent, patterns } of intentPatterns) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return intent;
    }
  }

  // Check keywords (less specific)
  for (const { intent, keywords } of intentPatterns) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return intent;
    }
  }

  // Try entity-based classification before giving up
  const entities = detectEntities(normalized);

  if (entities.jobIdentifier && entities.dataType === "estimates") {
    return "ESTIMATE_LOOKUP";
  }
  if (entities.jobIdentifier && (entities.dataType === "materials" || entities.dataType === "paint")) {
    return "MATERIAL_LOOKUP";
  }
  if (entities.jobIdentifier) {
    return "JOB_LOOKUP";
  }
  if (entities.dateRange && (entities.dataType === "invoices" || entities.dataType === "payments")) {
    return "INVOICE_LOOKUP";
  }

  // Default to out of scope if no match
  return "OUT_OF_SCOPE";
}

// Entity detection functions
export function detectEntities(userInput: string): DetectedEntities {
  const normalized = userInput.toLowerCase().trim();
  const entities: DetectedEntities = {};

  // Detect data type
  if (/(estimate|quoted|quote)/i.test(normalized)) {
    entities.dataType = "estimates";
  } else if (/(material|paint|color|sheen|gallon)/i.test(normalized)) {
    entities.dataType = normalized.includes("paint") ? "paint" : "materials";
  } else if (/(invoice)/i.test(normalized)) {
    entities.dataType = "invoices";
  } else if (/(payment|paid|received)/i.test(normalized)) {
    entities.dataType = "payments";
  } else if (/(customer)/i.test(normalized)) {
    entities.dataType = "customers";
  } else if (/(job)/i.test(normalized)) {
    entities.dataType = "jobs";
  }

  // Detect relationship patterns
  if (/accepted.*(but|without|no).*invoice/i.test(normalized)) {
    entities.relationship = "accepted_no_invoice";
  } else if (/(unpaid|not paid|haven't paid|outstanding)/i.test(normalized)) {
    entities.relationship = "unpaid";
  } else if (/(overdue|late|past due)/i.test(normalized)) {
    entities.relationship = "overdue";
  }

  // Detect date ranges
  if (/(today|scheduled today)/i.test(normalized)) {
    entities.dateRange = "today";
  } else if (/(tomorrow)/i.test(normalized)) {
    entities.dateRange = "tomorrow";
  } else if (/(this week)/i.test(normalized)) {
    entities.dateRange = "this_week";
  } else if (/(last month)/i.test(normalized)) {
    entities.dateRange = "last_month";
  }

  // Detect job identifier (customer name, job keyword)
  // Look for proper nouns or quoted strings
  const properNounMatch = normalized.match(/(?:for|job|customer)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (properNounMatch) {
    entities.jobIdentifier = properNounMatch[1];
  }

  // Also check for common patterns like "Smith job" or "Johnson exterior"
  const jobNameMatch = normalized.match(/([A-Z][a-z]+)\s+(job|exterior|interior|house|property)/i);
  if (jobNameMatch) {
    entities.jobIdentifier = jobNameMatch[1];
  }

  return entities;
}
