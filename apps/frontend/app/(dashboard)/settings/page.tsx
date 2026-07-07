"use client";

import { useAuth } from "@/lib/auth-context";
import { useOrganizations } from "@/lib/hooks";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: organizations } = useOrganizations();
  const org = organizations?.[0];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and organization.
        </p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Account</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-100">{user?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-100">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email verified</dt>
            <dd className={user?.emailVerified ? "text-emerald-400" : "text-yellow-400"}>
              {user?.emailVerified ? "Verified" : "Pending verification"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Organization</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-100">{org?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Slug</dt>
            <dd className="text-gray-100">{org?.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Plan</dt>
            <dd className="text-gray-100">{org?.subscription?.plan ?? "FREE"}</dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-gray-600">
        Editing these fields, team member management, and API key management aren&apos;t
        built yet.
      </p>
    </div>
  );
}
