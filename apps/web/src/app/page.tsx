"use client";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/utils/trpc";

export default function Home() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const branches = useQuery(trpc.getBranches.queryOptions());
  const horizon = useQuery(trpc.getScheduleHorizon.queryOptions());

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 border-b pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SMS — Smart Medicine Scheduler</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Autonomous availability monitor, 3-rule deterministic engine & sub-second Playwright
              booker
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                healthCheck.data?.status === "OK" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="font-medium">
              {healthCheck.isLoading
                ? "Connecting..."
                : healthCheck.data?.status === "OK"
                  ? "Engine Online"
                  : "Engine Offline"}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Monitored Branches */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <span>🏥</span> Monitored Dispensary Branches
          </h2>
          <div className="space-y-3">
            {branches.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading branches...</p>
            ) : branches.data && branches.data.length > 0 ? (
              branches.data.map((b) => (
                <div
                  key={b.key}
                  className="rounded-lg border bg-muted/30 p-3 text-sm flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span>Sede Medellín {b.key}</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-semibold">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{b.name}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No branches found.</p>
            )}
          </div>
        </section>

        {/* Poller Horizon & Intelligence */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <span>⚡</span> Deterministic Engine & Cadence
          </h2>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Target Date Horizon (D+1)
              </span>
              <p className="text-lg font-bold text-primary mt-1">
                {horizon.isLoading ? "Calculating..." : horizon.data?.tomorrow || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                Timezone: {horizon.data?.timezone || "America/Bogota"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border p-3">
                <span className="text-muted-foreground">Rule 1 (Volume)</span>
                <p className="font-semibold mt-1">&gt; 2 schedule items</p>
              </div>
              <div className="rounded-lg border p-3">
                <span className="text-muted-foreground">Rule 2 (Availability)</span>
                <p className="font-semibold mt-1">status == &quot;free&quot;</p>
              </div>
            </div>

            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 text-xs flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  Telegram 1-Click Booker
                </p>
                <p className="text-muted-foreground">
                  Human-in-the-loop authorization via inline keyboard
                </p>
              </div>
              <span className="text-lg">🤖</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
