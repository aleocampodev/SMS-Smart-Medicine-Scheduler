"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@SMS/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@SMS/ui/components/card";
import { Input } from "@SMS/ui/components/input";
import { Label } from "@SMS/ui/components/label";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function maskDocument(doc: string): string {
  if (doc.length <= 4) return "*".repeat(doc.length);
  return `${"*".repeat(doc.length - 4)}${doc.slice(-4)}`;
}

const initialProfileForm = {
  displayName: "",
  documentType: "CC",
  documentNumber: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  phone: "",
  email: "",
};

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialProfileForm);

  const branches = useQuery(trpc.getBranches.queryOptions());
  const profiles = useQuery(trpc.profiles.list.queryOptions());
  const appointments = useQuery(trpc.appointments.list.queryOptions());
  const monitor = useQuery(trpc.monitor.get.queryOptions());

  const setMonitorStatus = useMutation(
    trpc.monitor.setStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.monitor.get.queryKey() });
        toast.success("Monitor status updated");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const createProfile = useMutation(
    trpc.profiles.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.profiles.list.queryKey() });
        setForm(initialProfileForm);
        toast.success("Patient profile created");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const deleteProfile = useMutation(
    trpc.profiles.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.profiles.list.queryKey() });
        toast.success("Patient profile deleted");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const updateAppointmentStatus = useMutation(
    trpc.appointments.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.appointments.list.queryKey() });
        toast.success("Appointment status updated");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const handleCreateProfile = (e: FormEvent) => {
    e.preventDefault();
    createProfile.mutate(form);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Smart Medicine Scheduler</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {session.user.email}. Monitoring Nueva EPS dispensaries with Telegram
            pre-search confirmation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md border px-3 py-1.5 text-xs font-medium">
            Monitor: {monitor.data?.status ?? "LOADING"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={setMonitorStatus.isPending || monitor.data?.status === "ACTIVE"}
            onClick={() => setMonitorStatus.mutate({ status: "ACTIVE" })}
          >
            Activate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={setMonitorStatus.isPending || monitor.data?.status === "PAUSED"}
            onClick={() => setMonitorStatus.mutate({ status: "PAUSED" })}
          >
            Pause
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monitored Branches</CardTitle>
            <CardDescription>
              Active: {monitor.data?.selectedBranches.join(", ") ?? "—"}
            </CardDescription>
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
            <CardDescription>Alerted &amp; booked slots</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{appointments.data?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient Profiles</CardTitle>
            <CardDescription>Manage family member records for auto-booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              {profiles.isLoading ? (
                <p className="text-muted-foreground">Loading profiles...</p>
              ) : profiles.data && profiles.data.length > 0 ? (
                profiles.data.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">{p.displayName}</div>
                      <div className="text-muted-foreground text-xs">
                        {p.documentType} {maskDocument(p.documentNumber)} · {p.email}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleteProfile.isPending}
                      onClick={() => deleteProfile.mutate({ id: p.id })}
                    >
                      Delete
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No profiles created yet.</p>
              )}
            </div>

            <form
              onSubmit={handleCreateProfile}
              className="grid gap-3 border-t pt-4 sm:grid-cols-2"
            >
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  required
                  placeholder="Alex (Primary)"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="documentType">Document Type</Label>
                <Input
                  id="documentType"
                  required
                  value={form.documentType}
                  onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="documentNumber">Document Number</Label>
                <Input
                  id="documentNumber"
                  required
                  value={form.documentNumber}
                  onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="birthDate">Birth Date</Label>
                <Input
                  id="birthDate"
                  required
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={createProfile.isPending}>
                  {createProfile.isPending ? "Saving..." : "Add Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {appt.slotDate} {appt.slotTime ?? ""}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Branch: {appt.branchId}
                        {appt.confirmationCode ? ` · Code: ${appt.confirmationCode}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary px-2 py-1 text-xs font-medium uppercase">
                        {appt.status}
                      </span>
                      {appt.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updateAppointmentStatus.isPending}
                          onClick={() =>
                            updateAppointmentStatus.mutate({ id: appt.id, status: "cancelled" })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No appointments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
