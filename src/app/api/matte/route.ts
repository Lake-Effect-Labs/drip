import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { classifyIntent, detectEntities } from "@/lib/matte/intents";
import {
  getUnpaidInvoices,
  getOverdueInvoices,
  getPaymentsThisWeek,
  getJobsForDate,
  getJobsInProgress,
  getStuckJobs,
  getMaterialsForDate,
  getJobsMissingMaterials,
  getFocusToday,
  getGeneralSummary,
  getJobsByNameOrCustomer,
  getEstimatesForJob,
  getMaterialsForJob,
  getInvoicesForDateRange,
  getCustomersWithUnpaidInvoices,
  getJobsWithAcceptedEstimatesButNoInvoice,
} from "@/lib/matte/queries";

// System prompt for Matte
const SYSTEM_PROMPT = `You are Matte, a helpful assistant for a painting contractor. You answer questions about their business using only the data provided. You have access to comprehensive data about jobs, customers, estimates, invoices, payments, and materials.

Rules:
- Be concise (1-3 sentences max)
- Use bullet points for lists
- Never invent numbers or facts - only use the data provided
- Never ask follow-up questions
- Never say "as an AI" or explain how you work
- If no data: "I don't have that information right now."
- If out of scope: "I can only answer questions about your jobs, customers, invoices, estimates, payments, and materials."
- Use natural, conversational language
- Format currency as dollars (e.g., "$1,200" not "1200 cents")
- When showing job details, include relevant information like customer, status, and dates
- Be helpful and specific with your answers`;

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

    // Classify intent
    const intent = classifyIntent(message);

    // Detect entities for flexible queries
    const entities = detectEntities(message);

    // Fetch data based on intent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = {};
    let userPrompt = "";
    let specificRefusal = "";

    switch (intent) {
      case "UNPAID_INVOICES": {
        const result = await getUnpaidInvoices(adminSupabase, companyId);
        data = result;
        const totalDollars = (result.total / 100).toFixed(2);
        userPrompt = `The user asked about unpaid invoices. Here's the data:
- Count: ${result.count}
- Total: $${totalDollars}
- Invoices: ${JSON.stringify(result.invoices.map((inv) => ({ customer: inv.customerName, amount: `$${(inv.amount / 100).toFixed(2)}` })))}

Respond concisely about who hasn't paid.`;
        break;
      }

      case "OVERDUE_INVOICES": {
        const result = await getOverdueInvoices(adminSupabase, companyId);
        data = result;
        const totalDollars = (result.total / 100).toFixed(2);
        userPrompt = `The user asked about overdue invoices. Here's the data:
- Count: ${result.count}
- Total: $${totalDollars}
- Invoices: ${JSON.stringify(result.invoices.map((inv) => ({ customer: inv.customerName, amount: `$${(inv.amount / 100).toFixed(2)}` })))}

Respond concisely about overdue invoices.`;
        break;
      }

      case "PAYMENTS_THIS_WEEK": {
        const result = await getPaymentsThisWeek(adminSupabase, companyId);
        data = result;
        const totalDollars = (result.total / 100).toFixed(2);
        userPrompt = `The user asked about payments this week. Here's the data:
- Count: ${result.count}
- Total: $${totalDollars}
- Payments: ${JSON.stringify(result.payments.map((p) => ({ customer: p.customerName, amount: `$${(p.amount / 100).toFixed(2)}` })))}

Respond concisely about payments received this week.`;
        break;
      }

      case "JOBS_TODAY": {
        const today = new Date();
        const result = await getJobsForDate(adminSupabase, companyId, today);
        data = result;
        
        // Format today's date for the prompt
        const todayStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        
        userPrompt = `The user asked about jobs today (${todayStr}). Here's the data:
- Count: ${result.count}
- Jobs: ${JSON.stringify(result.jobs.map((j) => ({ title: j.title, customer: j.customerName, status: j.status, scheduledDate: j.scheduledDate })))}

Respond concisely about today's jobs. If count is 0, say "You have no jobs scheduled for today."`;
        break;
      }

      case "JOBS_TOMORROW": {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const result = await getJobsForDate(adminSupabase, companyId, tomorrow);
        data = result;
        userPrompt = `The user asked about jobs tomorrow. Here's the data:
- Count: ${result.count}
- Jobs: ${JSON.stringify(result.jobs.map((j) => ({ title: j.title, customer: j.customerName, status: j.status })))}

Respond concisely about tomorrow's jobs.`;
        break;
      }

      case "JOBS_IN_PROGRESS": {
        const result = await getJobsInProgress(adminSupabase, companyId);
        data = result;
        userPrompt = `The user asked about jobs in progress. Here's the data:
- Count: ${result.count}
- Jobs: ${JSON.stringify(result.jobs.map((j) => ({ title: j.title, customer: j.customerName, status: j.status })))}

Respond concisely about active jobs.`;
        break;
      }

      case "STUCK_JOBS": {
        const result = await getStuckJobs(adminSupabase, companyId);
        data = result;
        userPrompt = `The user asked about stuck jobs. Here's the data:
- Count: ${result.count}
- Jobs: ${JSON.stringify(result.jobs.map((j) => ({ title: j.title, customer: j.customerName, status: j.status })))}

Respond concisely about jobs that haven't moved.`;
        break;
      }

      case "MATERIALS_TODAY": {
        const result = await getMaterialsForDate(adminSupabase, companyId, new Date());
        data = result;
        userPrompt = `The user asked about materials needed (defaulting to today if no date specified). Here's the data:
- Materials: ${JSON.stringify(result.materials.map((m) => ({ name: m.name, job: m.jobTitle, customer: m.customerName })))}

Respond concisely about materials needed. If no materials, say "You don't need any materials today."`;
        break;
      }

      case "MATERIALS_TOMORROW": {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const result = await getMaterialsForDate(adminSupabase, companyId, tomorrow);
        data = result;
        userPrompt = `The user asked about materials needed tomorrow. Here's the data:
- Materials: ${JSON.stringify(result.materials.map((m) => ({ name: m.name, job: m.jobTitle, customer: m.customerName })))}

Respond concisely about materials needed tomorrow.`;
        break;
      }

      case "JOBS_MISSING_MATERIALS": {
        const result = await getJobsMissingMaterials(adminSupabase, companyId);
        data = result;
        userPrompt = `The user asked about jobs missing materials. Here's the data:
- Count: ${result.count}
- Jobs: ${JSON.stringify(result.jobs.map((j) => ({ title: j.title, customer: j.customerName })))}

Respond concisely about jobs that need materials added.`;
        break;
      }

      case "FOCUS_TODAY": {
        const result = await getFocusToday(adminSupabase, companyId);
        data = result;
        const unpaidTotalDollars = (result.unpaidTotal / 100).toFixed(2);
        userPrompt = `The user asked what to focus on today. Here's the data:
- Jobs today: ${result.jobsToday}
- Unpaid invoices: ${result.unpaidInvoices}
- Unpaid total: $${unpaidTotalDollars}

Respond concisely about what to work on today.`;
        break;
      }

      case "GENERAL_SUMMARY": {
        const result = await getGeneralSummary(adminSupabase, companyId);
        data = result;
        const invoicedDollars = (result.totalInvoiced / 100).toFixed(2);
        const paidDollars = (result.totalPaid / 100).toFixed(2);
        userPrompt = `The user asked for a summary. Here's the data:
- Total jobs: ${result.totalJobs}
- Active jobs: ${result.activeJobs}
- Total invoiced: $${invoicedDollars}
- Total paid: $${paidDollars}
- Unpaid invoices: ${result.unpaidCount}

Respond concisely with a brief summary.`;
        break;
      }

      case "TOTAL_JOBS": {
        const result = await getGeneralSummary(adminSupabase, companyId);
        data = result;
        userPrompt = `The user asked about total jobs. Here's the data:
- Total jobs: ${result.totalJobs}

Respond concisely with the total number of jobs.`;
        break;
      }

      case "TOTAL_REVENUE": {
        const result = await getGeneralSummary(adminSupabase, companyId);
        data = result;
        const invoicedDollars = (result.totalInvoiced / 100).toFixed(2);
        userPrompt = `The user asked about total revenue. Here's the data:
- Total invoiced: $${invoicedDollars}

Respond concisely with the total revenue/invoiced amount.`;
        break;
      }

      case "JOBS_THIS_WEEK": {
        // Calculate jobs this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: jobs } = await adminSupabase
          .from("jobs")
          .select("id, created_at")
          .eq("company_id", companyId)
          .gte("created_at", weekAgo.toISOString());
        const jobsThisWeek = jobs?.length || 0;
        data = { count: jobsThisWeek };
        userPrompt = `The user asked about jobs this week. Here's the data:
- Jobs this week: ${jobsThisWeek}

Respond concisely with how many jobs were created this week.`;
        break;
      }

      case "ACTIVE_JOBS": {
        const result = await getGeneralSummary(adminSupabase, companyId);
        data = result;
        userPrompt = `The user asked about active jobs. Here's the data:
- Active jobs: ${result.activeJobs}

Respond concisely with how many active jobs (scheduled or in progress) they have.`;
        break;
      }

      case "JOBS_BY_STATUS": {
        const { data: jobs } = await adminSupabase
          .from("jobs")
          .select("status")
          .eq("company_id", companyId);
        const jobsByStatus = (jobs || []).reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        data = { jobsByStatus };
        userPrompt = `The user asked about jobs by status. Here's the data:
${JSON.stringify(jobsByStatus)}

Respond concisely with a breakdown of jobs by status.`;
        break;
      }

      // New flexible intent handlers
      case "JOB_LOOKUP":
      case "ESTIMATE_LOOKUP":
      case "MATERIAL_LOOKUP": {
        if (!entities.jobIdentifier) {
          specificRefusal = "I need a job or customer name to look up that information.";
          break;
        }

        // First, find the job(s)
        const jobsResult = await getJobsByNameOrCustomer(adminSupabase, companyId, entities.jobIdentifier);

        if (jobsResult.count === 0) {
          specificRefusal = `I don't see any jobs matching "${entities.jobIdentifier}".`;
          break;
        }

        const job = jobsResult.jobs[0]; // Use first match

        if (intent === "ESTIMATE_LOOKUP") {
          const estimateResult = await getEstimatesForJob(adminSupabase, companyId, job.id);
          if (estimateResult.count === 0) {
            specificRefusal = `I don't see any estimates for the ${job.title} job.`;
            break;
          }
          data = estimateResult;
          const totalDollars = (estimateResult.total / 100).toFixed(2);
          userPrompt = `The user asked about estimates for the "${job.title}" job (customer: ${job.customerName}). Here's the data:
- Count: ${estimateResult.count}
- Total: $${totalDollars}
- Estimates: ${JSON.stringify(estimateResult.estimates.map((e) => ({
  status: e.status,
  total: `$${(e.total / 100).toFixed(2)}`,
  lineItems: e.lineItems.slice(0, 3)
})))}

Respond concisely about the estimate amount and status.`;
        } else if (intent === "MATERIAL_LOOKUP") {
          const materialsResult = await getMaterialsForJob(adminSupabase, companyId, job.id);
          if (materialsResult.materials.length === 0) {
            specificRefusal = `I don't see any materials listed for the ${job.title} job.`;
            break;
          }
          data = materialsResult;
          userPrompt = `The user asked about materials/paint for the "${job.title}" job (customer: ${job.customerName}). Here's the data:
- Materials: ${JSON.stringify(materialsResult.materials.map((m) => ({
  name: m.name,
  paintColor: m.paintColor,
  sheen: m.sheen,
  checked: m.checked
})))}

Respond concisely about what materials/paint are needed.`;
        } else {
          // JOB_LOOKUP
          data = jobsResult;
          userPrompt = `The user asked about jobs matching "${entities.jobIdentifier}". Here's the data:
- Count: ${jobsResult.count}
- Jobs: ${JSON.stringify(jobsResult.jobs.map((j) => ({
  title: j.title,
  customer: j.customerName,
  status: j.status,
  scheduledDate: j.scheduledDate
})))}

Respond concisely about the job(s) found.`;
        }
        break;
      }

      case "INVOICE_LOOKUP": {
        let startDate: Date;
        let endDate: Date;

        if (entities.dateRange === "last_month") {
          const now = new Date();
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (entities.dateRange === "this_week") {
          const now = new Date();
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          endDate = new Date(now);
          endDate.setDate(now.getDate() + (7 - dayOfWeek));
        } else {
          specificRefusal = "I need a date range (like 'last month' or 'this week') to look up invoices.";
          break;
        }

        const invoiceResult = await getInvoicesForDateRange(adminSupabase, companyId, startDate, endDate);

        if (invoiceResult.count === 0) {
          specificRefusal = `I don't see any invoices in that date range.`;
          break;
        }

        data = invoiceResult;
        const totalDollars = (invoiceResult.total / 100).toFixed(2);
        const dateRangeStr = entities.dateRange === "last_month" ? "last month" : "this week";
        userPrompt = `The user asked about invoices for ${dateRangeStr}. Here's the data:
- Count: ${invoiceResult.count}
- Total: $${totalDollars}
- Invoices: ${JSON.stringify(invoiceResult.invoices.map((inv) => ({
  customer: inv.customerName,
  job: inv.jobTitle,
  amount: `$${(inv.amount / 100).toFixed(2)}`,
  status: inv.status
})))}

Respond concisely about the invoices in that period.`;
        break;
      }

      case "CUSTOMER_LOOKUP": {
        const customerResult = await getCustomersWithUnpaidInvoices(adminSupabase, companyId);

        if (customerResult.customers.length === 0) {
          specificRefusal = "All customers have paid their invoices!";
          break;
        }

        data = customerResult;
        userPrompt = `The user asked about customers who owe money. Here's the data:
- Customers: ${JSON.stringify(customerResult.customers.map((c) => ({
  name: c.name,
  unpaidCount: c.unpaidCount,
  total: `$${(c.unpaidTotal / 100).toFixed(2)}`
})))}

Respond concisely about which customers have unpaid invoices.`;
        break;
      }

      case "RELATIONSHIP_QUERY": {
        if (entities.relationship === "accepted_no_invoice") {
          const relationshipResult = await getJobsWithAcceptedEstimatesButNoInvoice(adminSupabase, companyId);

          if (relationshipResult.count === 0) {
            specificRefusal = "All jobs with accepted estimates have been invoiced!";
            break;
          }

          data = relationshipResult;
          userPrompt = `The user asked about jobs with accepted estimates but no invoice. Here's the data:
- Count: ${relationshipResult.count}
- Jobs: ${JSON.stringify(relationshipResult.jobs.map((j) => ({
  title: j.title,
  customer: j.customerName,
  acceptedAt: j.acceptedAt
})))}

Respond concisely about which jobs need invoices created.`;
        }
        break;
      }

      case "OUT_OF_SCOPE": {
        return NextResponse.json({
          response: "I can only answer questions about your jobs, invoices, estimates, materials, and customers.",
        });
      }

      default: {
        // Fallback: fetch comprehensive data for general questions
        const [generalData, jobsData, invoicesData, customersData] = await Promise.all([
          getGeneralSummary(adminSupabase, companyId),
          adminSupabase
            .from("jobs")
            .select("id, title, status, scheduled_date, scheduled_time, customer:customers(name)")
            .eq("company_id", companyId)
            .limit(20)
            .order("created_at", { ascending: false }),
          adminSupabase
            .from("invoices")
            .select("id, amount_total, status, created_at, customer:customers(name), job:jobs(title)")
            .eq("company_id", companyId)
            .limit(10)
            .order("created_at", { ascending: false }),
          adminSupabase
            .from("customers")
            .select("id, name, email, phone")
            .eq("company_id", companyId)
            .limit(10)
            .order("name")
        ]);

        const recentJobs = (jobsData.data || []).map(j => ({
          title: j.title,
          status: j.status,
          customer: (j.customer as any)?.name || "Unknown",
          scheduledDate: j.scheduled_date,
          scheduledTime: j.scheduled_time
        }));

        const recentInvoices = (invoicesData.data || []).map(i => ({
          customer: (i.customer as any)?.name || "Unknown",
          job: (i.job as any)?.title || "Unknown",
          amount: `$${(i.amount_total / 100).toFixed(2)}`,
          status: i.status
        }));

        const customers = (customersData.data || []).map(c => ({
          name: c.name,
          email: c.email,
          phone: c.phone
        }));

        data = { generalData, recentJobs, recentInvoices, customers };
        userPrompt = `The user asked: "${message}"

Here's what I know about the business:
- Total jobs: ${generalData.totalJobs}
- Active jobs: ${generalData.activeJobs}
- Total invoiced: $${(generalData.totalInvoiced / 100).toFixed(2)}
- Total paid: $${(generalData.totalPaid / 100).toFixed(2)}
- Unpaid invoices: ${generalData.unpaidCount}

Recent jobs (last 20):
${JSON.stringify(recentJobs)}

Recent invoices (last 10):
${JSON.stringify(recentInvoices)}

Customers:
${JSON.stringify(customers)}

Use this data to answer the user's question. Be specific and helpful. If the question is about a specific job, customer, invoice, or material, provide details from the data above.`;
        break;
      }
    }

    // Handle specific refusals first
    if (specificRefusal) {
      return NextResponse.json({
        response: specificRefusal,
      });
    }

    // Check if data is empty (skip check for metrics and date-based queries that should return 0)
    const skipEmptyCheck = [
      "TOTAL_JOBS",
      "TOTAL_REVENUE",
      "JOBS_THIS_WEEK",
      "ACTIVE_JOBS",
      "JOBS_BY_STATUS",
      "JOBS_TODAY",
      "JOBS_TOMORROW",
      "MATERIALS_TODAY",
      "MATERIALS_TOMORROW"
    ].includes(intent);
    if (
      !skipEmptyCheck &&
      (
        (data.count !== undefined && data.count === 0) ||
        (data.jobs && data.jobs.length === 0) ||
        (data.materials && data.materials.length === 0) ||
        (data.payments && data.payments.length === 0)
      )
    ) {
      return NextResponse.json({
        response: "I don't see any data for that right now.",
      });
    }

    // Call OpenAI API (using gpt-4o-mini for cost efficiency)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // Fallback response if API key not configured
      return NextResponse.json({
        response: "I can help answer questions about your jobs, invoices, and materials.",
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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", await openaiResponse.text());
      return NextResponse.json({
        response: "I'm having trouble right now. Please try again.",
      });
    }

    const openaiData = await openaiResponse.json();
    const response = openaiData.choices[0]?.message?.content || "I don't have an answer for that.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Matte API error:", error);
    return NextResponse.json(
      { response: "I'm having trouble right now. Please try again." },
      { status: 500 }
    );
  }
}
