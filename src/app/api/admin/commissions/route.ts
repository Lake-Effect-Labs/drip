import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET - List unpaid commissions grouped by affiliate
export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await adminSupabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all referrals with commission_owed > 0
    const { data: referrals, error } = await adminSupabase
      .from("referrals")
      .select("id, creator_code_id, commission_owed, commission_paid, converted_at, created_at")
      .not("converted_at", "is", null)
      .order("converted_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Get all creator codes to map to affiliates
    const codeIds = [...new Set((referrals || []).map(r => r.creator_code_id))];
    if (codeIds.length === 0) {
      return NextResponse.json({ affiliates: [], totals: { unpaid: 0, paid: 0 } });
    }

    const { data: codes } = await adminSupabase
      .from("creator_codes")
      .select("id, code, creator_name, creator_email, user_id")
      .in("id", codeIds);

    const codeMap = new Map((codes || []).map(c => [c.id, c]));

    // Group by affiliate
    const affiliateMap = new Map<string, {
      code: string;
      creatorName: string;
      creatorEmail: string;
      unpaid: number;
      paid: number;
      unpaidCount: number;
      paidCount: number;
      referralIds: string[];
    }>();

    for (const ref of referrals || []) {
      const code = codeMap.get(ref.creator_code_id);
      if (!code) continue;

      const key = ref.creator_code_id;
      if (!affiliateMap.has(key)) {
        affiliateMap.set(key, {
          code: code.code,
          creatorName: code.creator_name,
          creatorEmail: code.creator_email,
          unpaid: 0,
          paid: 0,
          unpaidCount: 0,
          paidCount: 0,
          referralIds: [],
        });
      }

      const aff = affiliateMap.get(key)!;
      if (ref.commission_paid) {
        aff.paid += ref.commission_owed || 0;
        aff.paidCount++;
      } else {
        aff.unpaid += ref.commission_owed || 0;
        aff.unpaidCount++;
        aff.referralIds.push(ref.id);
      }
    }

    const affiliates = Array.from(affiliateMap.entries()).map(([codeId, data]) => ({
      codeId,
      ...data,
    }));

    const totals = {
      unpaid: affiliates.reduce((sum, a) => sum + a.unpaid, 0),
      paid: affiliates.reduce((sum, a) => sum + a.paid, 0),
    };

    return NextResponse.json({ affiliates, totals });
  } catch (error) {
    console.error("Error fetching commissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch commissions" },
      { status: 500 }
    );
  }
}

// POST - Mark commissions as paid for an affiliate
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await adminSupabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { referralIds } = body;

    if (!referralIds || !Array.isArray(referralIds) || referralIds.length === 0) {
      return NextResponse.json(
        { error: "referralIds array is required" },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase
      .from("referrals")
      .update({
        commission_paid: true,
        commission_paid_at: new Date().toISOString(),
      })
      .in("id", referralIds);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      markedPaid: referralIds.length,
    });
  } catch (error) {
    console.error("Error marking commissions paid:", error);
    return NextResponse.json(
      { error: "Failed to update commissions" },
      { status: 500 }
    );
  }
}
