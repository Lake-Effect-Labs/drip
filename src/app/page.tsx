import Link from "next/link";
import { Droplet, ArrowRight, CheckCircle, Calendar, FileText, Package } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Droplet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Drip</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Built for painters, by painters
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-stone-900 mb-6">
            Run your painting company
            <br />
            <span className="text-stone-500">without the chaos</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8">
            Track jobs. Send estimates. Get paid. No setup. No training. Built for painters.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-stone-700 transition-colors"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-sm text-stone-500">No credit card required</span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Quick Estimates"
            description="Create professional estimates in seconds with sqft-based pricing"
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Job Board"
            description="See all your jobs at a glance. Drag cards between stages. Never lose track."
          />
          <FeatureCard
            icon={<CheckCircle className="w-6 h-6" />}
            title="Track Payments"
            description="Mark jobs as paid when you receive payment. Cash, check, Venmo — your choice."
          />
          <FeatureCard
            icon={<Package className="w-6 h-6" />}
            title="Simple Invoices"
            description="Create invoices from jobs. Send links to customers. Mark as paid when done."
          />
        </div>

        {/* Board Preview */}
        <div className="bg-white rounded-2xl shadow-xl border p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="grid grid-cols-7 gap-3 overflow-x-auto">
            {["New", "Quoted", "Scheduled", "In Progress", "Done", "Paid", "Archive"].map(
              (status, i) => (
                <div key={status} className="min-w-[140px]">
                  <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                    {status}
                  </div>
                  <div className="space-y-2">
                    {i < 4 && (
                      <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                        <div className="text-sm font-medium text-stone-800 mb-1">
                          {["Johnson Exterior", "Smith Kitchen", "Garcia Living Room", "Park Master Bath"][i]}
                        </div>
                        <div className="text-xs text-stone-500">
                          {["123 Oak St", "456 Maple Ave", "789 Pine Rd", "321 Cedar Ln"][i]}
                        </div>
                      </div>
                    )}
                    {i === 1 && (
                      <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                        <div className="text-sm font-medium text-stone-800 mb-1">Lee Bedroom</div>
                        <div className="text-xs text-stone-500">555 Elm St</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-stone-800 flex items-center justify-center">
              <Droplet className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Drip</span>
          </div>
          <p className="text-sm text-stone-500">
            © {new Date().getFullYear()} Drip. Built for painters.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
      <p className="text-sm text-stone-600">{description}</p>
    </div>
  );
}
