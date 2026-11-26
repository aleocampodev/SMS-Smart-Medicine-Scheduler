"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@SMS/ui/components/card";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const trpc = useTRPC();
  const branches = useQuery(trpc.getBranches.queryOptions());
  const profiles = useQuery(trpc.profiles.list.queryOptions());
  const appointments = useQuery(trpc.appointments.list.queryOptions());

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Medicine Scheduler</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {session.user.email}. Monitoring Nueva EPS dispensaries with Telegram
          pre-search confirmation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monitored Branches</CardTitle>
            <CardDescription>Configured Qanty endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{branches.data?.length ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Profiles</CardTitle>
            <CardDescription>Masked PII records in PostgreSQL</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{profiles.data?.length ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracked Appointments</CardTitle>
            <CardDescription>Alerted & booked slots</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{appointments.data?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Dispensaries</CardTitle>
            <CardDescription>Medellín target branches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {branches.isLoading ? (
              <p className="text-muted-foreground">Loading branches...</p>
            ) : (
              branches.data?.map((branch) => (
                <div key={branch.key} className="rounded-md border p-3">
                  <div className="font-medium">Branch {branch.key}</div>
                  <div className="text-muted-foreground text-xs">{branch.name}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
            <CardDescription>Latest alerts and bookings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {appointments.isLoading ? (
              <p className="text-muted-foreground">Loading appointments...</p>
            ) : appointments.data && appointments.data.length > 0 ? (
              appointments.data.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {appt.slotDate} {appt.slotTime ?? ""}
                    </div>
                    <div className="text-muted-foreground text-xs">Branch: {appt.branchId}</div>
                  </div>
                  <span className="rounded bg-secondary px-2 py-1 text-xs font-medium uppercase">
                    {appt.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No appointments recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
