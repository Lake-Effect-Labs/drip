import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Concise system prompt to minimize tokens
const SYSTEM_PROMPT = `You are Matte, a painting business assistant. Answer questions using ONLY the provided data. Be extremely brief - 1-3 sentences max. No greetings, no fluff, just facts. Format numbers as currency when relevant. If data not found, say "Not found" or "No data".`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get company ID
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = companyUser.company_id;
    const query = message.toLowerCase();

    // Fetch comprehensive business data based on query context
    const data = await fetchRelevantData(adminSupabase, companyId, query);

    // Build a concise data summary for the AI
    const dataSummary = buildDataSummary(data, query);

    // Call OpenAI with minimal tokens
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      // Fallback: generate basic response without AI
      return NextResponse.json({
        response: generateFallbackResponse(data, query),
      });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Question: ${message}\n\nData:\n${dataSummary}` },
        ],
        max_tokens: 150, // Keep responses short
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      console.error("OpenAI error:", await openaiResponse.text());
      return NextResponse.json({
        response: generateFallbackResponse(data, query),
      });
    }

    const openaiData = await openaiResponse.json();
    const response = openaiData.choices[0]?.message?.content || generateFallbackResponse(data, query);

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Matte API error:", error);
    return NextResponse.json(
      { response: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

interface BusinessData {
  jobs: any[];
  customers: any[];
  estimates: any[];
  invoices: any[];
  materials: any[];
  summary: {
    totalJobs: number;
    activeJobs: number;
    totalCustomers: number;
    unpaidInvoices: number;
    unpaidTotal: number;
    totalRevenue: number;
  };
}

async function fetchRelevantData(
  supabase: any,
  companyId: string,
  query: string
): Promise<BusinessData> {
  // Determine what data to fetch based on query keywords
  const needsJobs = /(job|schedul|today|tomorrow|work|progress|status)/i.test(query);
  const needsCustomers = /(customer|client|contact|phone|email|who)/i.test(query);
  const needsEstimates = /(estimate|quote|price|cost|paint|color|sheen|sqft|square)/i.test(query);
  const needsInvoices = /(invoice|paid|unpaid|owe|payment|revenue|money|overdue)/i.test(query);
  const needsMaterials = /(material|paint|color|gallon|sheen|product|supplies)/i.test(query);
  const needsSummary = /(total|how many|summary|overview|all)/i.test(query);

  // Always fetch at least some context
  const fetchAll = !needsJobs && !needsCustomers && !needsEstimates && !needsInvoices && !needsMaterials;

  const results: BusinessData = {
    jobs: [],
    customers: [],
    estimates: [],
    invoices: [],
    materials: [],
    summary: {
      totalJobs: 0,
      activeJobs: 0,
      totalCustomers: 0,
      unpaidInvoices: 0,
      unpaidTotal: 0,
      totalRevenue: 0,
    },
  };

  // Extract potential search terms (names, etc.)
  const searchTerms = extractSearchTerms(query);

  // Parallel data fetching for efficiency
  const promises: Promise<void>[] = [];

  // Jobs
  if (needsJobs || fetchAll || needsSummary) {
    promises.push(
      (async () => {
        let jobQuery = supabase
          .from("jobs")
          .select("id, title, status, scheduled_date, scheduled_end_date, scheduled_time, progress_percentage, address1, city, customer:customers(name, phone, email)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(30);

        // If searching for specific job/customer
        if (searchTerms.length > 0) {
          const searchConditions = searchTerms.map(term =>
            `title.ilike.%${term}%,customer.name.ilike.%${term}%`
          ).join(',');
          jobQuery = jobQuery.or(searchConditions);
        }

        const { data } = await jobQuery;
        results.jobs = data || [];
      })()
    );
  }

  // Customers
  if (needsCustomers || fetchAll) {
    promises.push(
      (async () => {
        let customerQuery = supabase
          .from("customers")
          .select("id, name, phone, email, address1, city, state, notes")
          .eq("company_id", companyId)
          .order("name")
          .limit(30);

        if (searchTerms.length > 0) {
          const searchConditions = searchTerms.map(term =>
            `name.ilike.%${term}%`
          ).join(',');
          customerQuery = customerQuery.or(searchConditions);
        }

        const { data } = await customerQuery;
        results.customers = data || [];
      })()
    );
  }

  // Estimates with line items and materials
  if (needsEstimates || needsMaterials || fetchAll) {
    promises.push(
      (async () => {
        const { data: estimates } = await supabase
          .from("estimates")
          .select(`
            id, status, sqft, accepted_at, created_at,
            job:jobs(id, title, customer:customers(name)),
            line_items:estimate_line_items(name, price, sqft, paint_color_name_or_code, sheen, product_line, gallons_estimate)
          `)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(20);

        results.estimates = estimates || [];

        // Also fetch estimate_materials for paint details
        if (estimates && estimates.length > 0) {
          const estimateIds = estimates.map((e: any) => e.id);
          const { data: materials } = await supabase
            .from("estimate_materials")
            .select("*, estimate:estimates(job:jobs(title, customer:customers(name)))")
            .in("estimate_id", estimateIds)
            .limit(50);

          results.materials = materials || [];
        }
      })()
    );
  }

  // Invoices
  if (needsInvoices || needsSummary || fetchAll) {
    promises.push(
      (async () => {
        const { data } = await supabase
          .from("invoices")
          .select("id, amount_total, status, created_at, customer:customers(name), job:jobs(title)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(20);

        results.invoices = data || [];
      })()
    );
  }

  // Summary stats
  if (needsSummary || fetchAll) {
    promises.push(
      (async () => {
        const [jobsCount, customersCount, invoicesData] = await Promise.all([
          supabase.from("jobs").select("id, status").eq("company_id", companyId),
          supabase.from("customers").select("id").eq("company_id", companyId),
          supabase.from("invoices").select("id, amount_total, status").eq("company_id", companyId),
        ]);

        const jobs = jobsCount.data || [];
        const invoices = invoicesData.data || [];

        results.summary = {
          totalJobs: jobs.length,
          activeJobs: jobs.filter((j: any) => ["scheduled", "in_progress"].includes(j.status)).length,
          totalCustomers: (customersCount.data || []).length,
          unpaidInvoices: invoices.filter((i: any) => i.status !== "paid").length,
          unpaidTotal: invoices.filter((i: any) => i.status !== "paid").reduce((sum: number, i: any) => sum + i.amount_total, 0),
          totalRevenue: invoices.reduce((sum: number, i: any) => sum + i.amount_total, 0),
        };
      })()
    );
  }

  await Promise.all(promises);
  return results;
}

function extractSearchTerms(query: string): string[] {
  // Remove common words and extract potential names/identifiers
  const stopWords = ['the', 'a', 'an', 'for', 'about', 'tell', 'me', 'what', 'how', 'many', 'much', 'is', 'are', 'do', 'does', 'have', 'has', 'need', 'needs', 'all', 'my', 'show', 'list', 'get', 'find', 'job', 'jobs', 'customer', 'customers', 'invoice', 'invoices', 'estimate', 'estimates', 'material', 'materials', 'paint', 'today', 'tomorrow', 'week', 'month'];

  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  return words.slice(0, 3); // Max 3 search terms
}

function buildDataSummary(data: BusinessData, query: string): string {
  const parts: string[] = [];

  // Summary stats
  if (data.summary.totalJobs > 0) {
    parts.push(`Stats: ${data.summary.totalJobs} jobs (${data.summary.activeJobs} active), ${data.summary.totalCustomers} customers, $${(data.summary.totalRevenue / 100).toFixed(0)} revenue, ${data.summary.unpaidInvoices} unpaid ($${(data.summary.unpaidTotal / 100).toFixed(0)})`);
  }

  // Jobs (concise)
  if (data.jobs.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const todayJobs = data.jobs.filter((j: any) => j.scheduled_date?.startsWith(today));

    const jobList = data.jobs.slice(0, 10).map((j: any) => {
      const customer = j.customer?.name || 'Unknown';
      const date = j.scheduled_date ? j.scheduled_date.split('T')[0] : 'unscheduled';
      return `${j.title} (${customer}, ${j.status}, ${date})`;
    });

    if (todayJobs.length > 0) {
      parts.push(`Today: ${todayJobs.length} jobs`);
    }
    parts.push(`Jobs: ${jobList.join('; ')}`);
  }

  // Customers (concise)
  if (data.customers.length > 0) {
    const customerList = data.customers.slice(0, 10).map((c: any) => {
      const contact = c.phone || c.email || 'no contact';
      return `${c.name} (${contact})`;
    });
    parts.push(`Customers: ${customerList.join('; ')}`);
  }

  // Estimates with paint details
  if (data.estimates.length > 0) {
    const estimateList = data.estimates.slice(0, 8).map((e: any) => {
      const job = e.job?.title || 'Unknown job';
      const customer = e.job?.customer?.name || '';
      const total = (e.line_items || []).reduce((sum: number, li: any) => sum + (li.price || 0), 0);
      const paintColors = (e.line_items || [])
        .filter((li: any) => li.paint_color_name_or_code)
        .map((li: any) => `${li.name}: ${li.paint_color_name_or_code} ${li.sheen || ''} ${li.gallons_estimate ? li.gallons_estimate + 'gal' : ''}`)
        .join(', ');

      return `${job} (${customer}): $${(total / 100).toFixed(0)}, ${e.status}${paintColors ? `, Paint: ${paintColors}` : ''}`;
    });
    parts.push(`Estimates: ${estimateList.join('; ')}`);
  }

  // Materials (paint details from estimate_materials)
  if (data.materials.length > 0) {
    const materialList = data.materials.slice(0, 15).map((m: any) => {
      const job = m.estimate?.job?.title || 'Unknown';
      const color = m.paint_color || m.area_description || 'N/A';
      const qty = m.quantity_gallons ? `${m.quantity_gallons}gal` : '';
      return `${job}: ${color} ${m.sheen || ''} ${m.product_line || ''} ${qty}`.trim();
    });
    parts.push(`Materials: ${materialList.join('; ')}`);
  }

  // Invoices (concise)
  if (data.invoices.length > 0) {
    const unpaid = data.invoices.filter((i: any) => i.status !== 'paid');
    if (unpaid.length > 0) {
      const unpaidList = unpaid.slice(0, 5).map((i: any) =>
        `${i.customer?.name || 'Unknown'}: $${(i.amount_total / 100).toFixed(0)}`
      );
      parts.push(`Unpaid: ${unpaidList.join('; ')}`);
    }
  }

  return parts.join('\n') || 'No data available.';
}

function generateFallbackResponse(data: BusinessData, query: string): string {
  const q = query.toLowerCase();

  // Job count questions
  if (/how many.*job/i.test(q)) {
    return `You have ${data.summary.totalJobs} total jobs, ${data.summary.activeJobs} active.`;
  }

  // Today's jobs
  if (/today/i.test(q) && /job/i.test(q)) {
    const today = new Date().toISOString().split('T')[0];
    const todayJobs = data.jobs.filter((j: any) => j.scheduled_date?.startsWith(today));
    if (todayJobs.length === 0) return "No jobs scheduled for today.";
    const list = todayJobs.map((j: any) => `${j.title} (${j.customer?.name || 'Unknown'})`).join(', ');
    return `${todayJobs.length} jobs today: ${list}`;
  }

  // Unpaid invoices
  if (/unpaid|owe/i.test(q)) {
    if (data.summary.unpaidInvoices === 0) return "No unpaid invoices!";
    const unpaid = data.invoices.filter((i: any) => i.status !== 'paid');
    const list = unpaid.slice(0, 5).map((i: any) =>
      `${i.customer?.name || 'Unknown'}: $${(i.amount_total / 100).toFixed(0)}`
    ).join(', ');
    return `${data.summary.unpaidInvoices} unpaid invoices ($${(data.summary.unpaidTotal / 100).toFixed(0)}): ${list}`;
  }

  // Customer questions
  if (/customer/i.test(q)) {
    if (data.customers.length === 0) return "No customers found.";
    const list = data.customers.slice(0, 5).map((c: any) => c.name).join(', ');
    return `${data.summary.totalCustomers} customers. Recent: ${list}`;
  }

  // Materials/paint
  if (/material|paint|color/i.test(q)) {
    if (data.materials.length === 0) return "No materials data found.";
    const list = data.materials.slice(0, 5).map((m: any) => {
      const color = m.paint_color || m.area_description || 'N/A';
      return `${m.estimate?.job?.title || 'Job'}: ${color}`;
    }).join(', ');
    return `Materials: ${list}`;
  }

  // Default summary
  return `${data.summary.totalJobs} jobs, ${data.summary.totalCustomers} customers, $${(data.summary.totalRevenue / 100).toFixed(0)} total revenue, ${data.summary.unpaidInvoices} unpaid invoices.`;
}
