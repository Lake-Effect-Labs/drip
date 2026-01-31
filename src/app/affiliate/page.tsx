import Link from "next/link";
import { Paintbrush, ArrowRight, DollarSign, Users, Repeat, Gift, CheckCircle, Mail } from "lucide-react";

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Matte</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
            <DollarSign className="w-4 h-4" />
            Affiliate Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-stone-900 mb-6">
            Earn 20% recurring commission
            <br />
            <span className="text-emerald-600">helping painters succeed</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8">
            Know painters who are drowning in paperwork? Help them get organized with Matte 
            and earn recurring income for every customer you refer.
          </p>
          <a
            href="mailto:affiliate@matte.biz?subject=Affiliate%20Application&body=Hi!%20I'd%20like%20to%20join%20the%20Matte%20affiliate%20program.%0A%0AName:%20%0ASocial/Website:%20%0AAudience%20size:%20%0AWhy%20I'd%20be%20a%20good%20fit:%20"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg transition-colors"
          >
            <Mail className="w-5 h-5" />
            Apply to Join
          </a>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-stone-700">1</span>
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">Get Your Code</h3>
              <p className="text-sm text-stone-600">
                Apply and receive your unique referral code (like &quot;PAINTERTOM&quot;)
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-stone-700">2</span>
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">Share With Painters</h3>
              <p className="text-sm text-stone-600">
                They sign up with your code and get $5 off their first month
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-stone-700">3</span>
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">Get Paid Monthly</h3>
              <p className="text-sm text-stone-600">
                Earn 20% of their subscription every month, for as long as they stay
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-2xl border shadow-lg p-8 mb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-6">Why Partner With Matte?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Repeat className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">Recurring Revenue</h3>
                <p className="text-sm text-stone-600">
                  20% commission every month, not just the first. Build passive income.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">Easy Sell</h3>
                <p className="text-sm text-stone-600">
                  Matte solves a real pain point. Painters love it once they try it.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">Your Audience Wins</h3>
                <p className="text-sm text-stone-600">
                  Give your followers $5 off while helping them get organized.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">Simple Dashboard</h3>
                <p className="text-sm text-stone-600">
                  Track referrals, conversions, and earnings in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Math */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-8 text-white mb-16">
          <h2 className="text-2xl font-bold mb-4">Do The Math</h2>
          <p className="text-emerald-100 mb-6">
            Matte is $29/month. You earn 20% = <strong>$5.80/month per customer</strong>.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold">10</div>
              <div className="text-sm text-emerald-200">referrals</div>
              <div className="text-lg font-semibold mt-1">$58/mo</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold">50</div>
              <div className="text-sm text-emerald-200">referrals</div>
              <div className="text-lg font-semibold mt-1">$290/mo</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold">100</div>
              <div className="text-sm text-emerald-200">referrals</div>
              <div className="text-lg font-semibold mt-1">$580/mo</div>
            </div>
          </div>
        </div>

        {/* Who Should Apply */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-8">Perfect For</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Painting YouTubers & content creators",
              "Trade business coaches & consultants",
              "Painting supply stores & distributors",
              "Painting contractor associations",
              "Home improvement influencers",
              "Painters with a big network",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 bg-white rounded-lg p-4 border">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-stone-700">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-stone-100 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Ready to Get Started?</h2>
          <p className="text-stone-600 mb-6">
            Email us with a bit about yourself and your audience. We&apos;ll get you set up within 24 hours.
          </p>
          <a
            href="mailto:affiliate@matte.biz?subject=Affiliate%20Application&body=Hi!%20I'd%20like%20to%20join%20the%20Matte%20affiliate%20program.%0A%0AName:%20%0ASocial/Website:%20%0AAudience%20size:%20%0AWhy%20I'd%20be%20a%20good%20fit:%20"
            className="inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg transition-colors"
          >
            <Mail className="w-5 h-5" />
            Apply Now
          </a>
          <p className="text-sm text-stone-500 mt-4">
            Questions? Email us at affiliate@matte.biz
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-stone-800 flex items-center justify-center">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Matte</span>
          </div>
          <p className="text-sm text-stone-500">
            © {new Date().getFullYear()} Matte. Built for painters.
          </p>
        </div>
      </footer>
    </div>
  );
}
