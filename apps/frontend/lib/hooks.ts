"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { api } from "./api";

export interface Subscription {
  id: string;
  plan: "FREE" | "STARTER" | "PROFESSIONAL" | "BUSINESS";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription: Subscription | null;
}

export interface Domain {
  id: string;
  organizationId: string;
  name: string;
  verified: boolean;
  verificationToken: string | null;
  createdAt: string;
  _count?: { assets: number };
}

export interface HealthStatus {
  status: "ok" | "degraded";
  database: "ok" | "error";
  checkedAt: string;
}

/** Backs the public `/status` page — a real, live check, not a fabricated
 * historical uptime record this build environment has no real monitoring
 * data to produce. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data } = await api.get<HealthStatus>("/health");
      return data;
    },
    // Polled so the page reflects the real current state without a manual
    // reload, same pattern as the dashboard's own polling hooks.
    refetchInterval: 15_000,
    retry: false,
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations", "me"],
    queryFn: async () => {
      const { data } = await api.get<Organization[]>("/organizations/me");
      return data;
    },
  });
}

export function useDomains(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["domains", organizationId],
    queryFn: async () => {
      const { data } = await api.get<Domain[]>("/domains", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateDomain(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<Domain>("/domains", {
        organizationId,
        name,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
    },
  });
}

export function useVerifyDomain(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string) => {
      const { data } = await api.patch<Domain>(`/domains/${domainId}/verify`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
    },
  });
}

export type AiDifficulty = "EASY" | "MODERATE" | "HARD";
export type AiPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Finding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: string;
  title: string;
  description: string;
  createdAt: string;
  aiExplanation?: string | null;
  aiBusinessImpact?: string | null;
  aiRemediation?: string | null;
  aiDifficulty?: AiDifficulty | null;
  aiPriority?: AiPriority | null;
}

export function useAnalyzeFinding() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: async (findingId: string) => {
      const { data } = await api.post<Finding>(
        `/ai/findings/${findingId}/analyze`,
        { locale },
      );
      return data;
    },
    onSuccess: () => {
      // The same finding can appear in both the per-domain findings list
      // and the org-wide "top risks" summary — invalidate both rather than
      // guessing which one is currently mounted.
      queryClient.invalidateQueries({ queryKey: ["risk"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export type FindingCategory =
  | "SSL"
  | "HEADERS"
  | "EXPOSURE"
  | "CONFIGURATION"
  | "ASSET_CHANGE"
  | "DNS"
  | "TECHNOLOGY";

export interface RiskResult {
  hasScan: boolean;
  scanId?: string;
  scannedAt?: string;
  score: number | null;
  categories?: Record<FindingCategory, { deduction: number; findings: number }>;
  findings: Finding[];
}

export function useDomainRisk(domainId: string | undefined) {
  return useQuery({
    queryKey: ["risk", domainId],
    queryFn: async () => {
      const { data } = await api.get<RiskResult>(
        `/risk/domains/${domainId}/latest`,
      );
      return data;
    },
    enabled: !!domainId,
    // Poll — a scan may complete moments after this is first fetched
    // (BullMQ processes it asynchronously), so refresh a few times rather
    // than requiring a manual reload.
    refetchInterval: (query) => (query.state.data?.hasScan ? false : 3000),
  });
}

export interface RiskHistoryPoint {
  scanId: string;
  date: string;
  score: number;
}

export function useDomainRiskHistory(domainId: string | undefined) {
  return useQuery({
    queryKey: ["risk-history", domainId],
    queryFn: async () => {
      const { data } = await api.get<RiskHistoryPoint[]>(
        `/risk/domains/${domainId}/history`,
      );
      return data;
    },
    enabled: !!domainId,
  });
}

export interface DashboardSummary {
  totalDomains: number;
  totalAssets: number;
  activeAlertsCount: number;
  resolvedAlertsCount: number;
  latestScan: { scanId: string; domainName: string; finishedAt: string } | null;
  topRisks: {
    id: string;
    domainName: string;
    severity: Finding["severity"];
    title: string;
    description: string;
    createdAt: string;
    aiExplanation?: string | null;
    aiBusinessImpact?: string | null;
    aiRemediation?: string | null;
    aiDifficulty?: AiDifficulty | null;
    aiPriority?: AiPriority | null;
  }[];
  upcomingCertExpirations: {
    id: string;
    domainName: string;
    value: string;
    daysUntilExpiry: number | null;
  }[];
  recentChanges: {
    id: string;
    type: string;
    severity: Finding["severity"];
    message: string;
    createdAt: string;
  }[];
}

export function useDashboardSummary(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-summary", organizationId],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
    // Real counts (assets/alerts/latest scan) can change moments after a
    // scan is triggered elsewhere on the page — refetch periodically
    // rather than requiring a manual reload, same pattern as useDomainRisk.
    refetchInterval: 5000,
  });
}

export interface Report {
  id: string;
  organizationId: string;
  scanId: string | null;
  title: string;
  format: "PDF" | "HTML";
  fileUrl: string | null;
  generatedAt: string;
}

export function useReports(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["reports", organizationId],
    queryFn: async () => {
      const { data } = await api.get<Report[]>("/reports", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
    // A freshly requested report generates asynchronously (BullMQ) — poll
    // for a while so "Generate report" doesn't require a manual refresh
    // to see the file become downloadable, same pattern as useDomainRisk.
    refetchInterval: (query) =>
      query.state.data?.some((r) => !r.fileUrl) ? 3000 : false,
  });
}

export function useCreateReport(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { scanId?: string; title?: string }) => {
      const { data } = await api.post<Report>("/reports", {
        organizationId,
        ...params,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", organizationId] });
    },
  });
}

export function useEmailReport() {
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data } = await api.post<{ success: boolean; sentTo: string }>(
        `/reports/${reportId}/email`,
      );
      return data;
    },
  });
}

/**
 * The download endpoint requires a real `Authorization` header (it's
 * behind `JwtAuthGuard`, same as every other report/domain/scan endpoint —
 * reports can contain real security findings, so this is deliberately not
 * a bare unauthenticated link) — a plain `<a href>` can't attach that
 * header, so this fetches the PDF as a blob through the same authenticated
 * `api` client everything else uses, then triggers a normal client-side
 * file download from the in-memory result.
 */
export async function downloadReport(reportId: string, title: string) {
  const response = await api.get(`/reports/${reportId}/download`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export interface AlertItem {
  id: string;
  organizationId: string;
  findingId: string | null;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  message: string;
  read: boolean;
  createdAt: string;
}

export function useAlerts(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["alerts", organizationId],
    queryFn: async () => {
      const { data } = await api.get<AlertItem[]>("/alerts", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useMarkAlertRead(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await api.patch<AlertItem>(`/alerts/${alertId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", organizationId] });
    },
  });
}

export function useMarkAllAlertsRead(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ updated: number }>(
        "/alerts/read-all",
        undefined,
        { params: { organizationId } },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", organizationId] });
    },
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      plan: "STARTER" | "PROFESSIONAL" | "BUSINESS";
      interval?: "monthly" | "yearly";
    }) => {
      const { data } = await api.post<{ url: string }>(
        "/billing/checkout-session",
        params,
      );
      return data;
    },
  });
}

// Same authenticated `api` instance as every other request in this app —
// the crypto checkout is an additional payment method for the already
// logged-in user's organization, not a separate anonymous flow.
export function useCreateCryptoCheckoutSession() {
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      plan: "STARTER" | "PROFESSIONAL";
    }) => {
      const { data } = await api.post<{ url: string }>(
        "/billing/crypto-checkout-session",
        params,
      );
      return data;
    },
  });
}

export interface PublicScanResult {
  domain: string;
  reachable: boolean;
  score: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "STRONG";
  topFinding: { severity: string; title: string; description: string } | null;
  additionalFindingsCount: number;
}

/** The landing page's anonymous "free instant scan" widget — no auth
 * required (there's no account yet), backed by the real, unauthenticated
 * `POST /public-scan` endpoint. Same `api` client as every other request;
 * the backend simply doesn't guard this one route. */
export function usePublicScan() {
  return useMutation({
    mutationFn: async (domain: string) => {
      const { data } = await api.post<PublicScanResult>("/public-scan", {
        domain,
      });
      return data;
    },
  });
}

export interface ScanStatus {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
}

// Polls a specific scan's own row (not the risk/findings it eventually
// produces) so the UI can show a real percentage while PENDING/RUNNING —
// distinct from `useDomainRisk`'s polling, which only ever reflects the
// *last completed* scan and has no notion of one currently in progress.
// Stops polling on its own once the scan reaches a terminal state.
export function useScanStatus(scanId: string | undefined) {
  return useQuery({
    queryKey: ["scan-status", scanId],
    queryFn: async () => {
      const { data } = await api.get<ScanStatus>(`/scans/${scanId}`);
      return data;
    },
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? 1500 : false;
    },
  });
}

export function useTriggerScan(domainId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ScanStatus>("/scans", { domainId });
      return data;
    },
    onSuccess: async () => {
      const riskKey = ["risk", domainId];
      const previousScanId = queryClient.getQueryData<RiskResult>(riskKey)?.scanId;

      // A real scan runs asynchronously (BullMQ) and can take up to ~30s of
      // real DNS/HTTP/TLS work — invalidating once right after the POST
      // resolves only ever refetches the *previous* scan's still-current
      // result (this domain already `hasScan: true` from before), and
      // `useDomainRisk`'s polling stops for good once any scan exists. Left
      // as a single invalidate, this domain's score/findings would look
      // frozen forever after the very first scan — poll for a bounded
      // window until a genuinely new `scanId` actually lands.
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await queryClient.refetchQueries({ queryKey: riskKey });
        const latest = queryClient.getQueryData<RiskResult>(riskKey);
        if (latest?.scanId && latest.scanId !== previousScanId) break;
      }
      queryClient.invalidateQueries({ queryKey: ["risk-history", domainId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER";

export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: MembershipRole;
  expiresAt: string;
  createdAt: string;
}

export function useMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["members", organizationId],
    queryFn: async () => {
      const { data } = await api.get<Member[]>("/invitations/members", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useInvitations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["invitations", organizationId],
    queryFn: async () => {
      const { data } = await api.get<Invitation[]>("/invitations", {
        params: { organizationId },
      });
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateInvitation(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { email: string; role: "ADMIN" | "MEMBER" }) => {
      const { data } = await api.post<Invitation>("/invitations", {
        organizationId,
        ...params,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", organizationId] });
    },
  });
}

export function useRevokeInvitation(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await api.delete(`/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", organizationId] });
    },
  });
}

export interface InvitationPreview {
  id: string;
  email: string;
  role: MembershipRole;
  organization: { name: string };
}

export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: async () => {
      const { data } = await api.get<InvitationPreview>(`/invitations/${token}`);
      return data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await api.post(`/invitations/${token}/accept`);
      return data;
    },
  });
}

export interface AuditLogEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export function useAuditLogs(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["audit-logs", organizationId],
    queryFn: async () => {
      const { data } = await api.get<AuditLogEntry[]>("/audit-logs", {
        params: { organizationId },
      });
      return data;
    },
    // Only fetched for org owners/admins in practice (the API itself
    // enforces this — a MEMBER gets a real 403, not just a hidden UI
    // element), but `retry: false` so a 403 here doesn't spam the network
    // with automatic retries for a request that will never succeed.
    enabled: !!organizationId,
    retry: false,
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (params: { name: string }) => {
      const { data } = await api.patch<{ name: string }>("/users/me", params);
      return data;
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (params: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const { data } = await api.post<{ success: boolean }>(
        "/users/me/change-password",
        params,
      );
      return data;
    },
  });
}

export interface MfaSetupResult {
  secret: string;
  qrCodeDataUrl: string;
}

/** Begins real TOTP enrollment — stores a pending secret server-side, not yet enabled until `useMfaEnable` confirms it. */
export function useMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MfaSetupResult>("/auth/mfa/setup");
      return data;
    },
  });
}

export interface MfaEnableResult {
  backupCodes: string[];
}

export function useMfaEnable() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post<MfaEnableResult>("/auth/mfa/enable", {
        code,
      });
      return data;
    },
  });
}

export function useMfaDisable() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { data } = await api.post<{ success: boolean }>(
        "/auth/mfa/disable",
        { password },
      );
      return data;
    },
  });
}

export interface NotificationSettings {
  webhookUrl: string | null;
  slackWebhookUrl: string | null;
  dailyDigestEnabled: boolean;
  weeklyDigestEnabled: boolean;
}

export function useNotificationSettings(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["notification-settings", organizationId],
    queryFn: async () => {
      const { data } = await api.get<NotificationSettings>(
        "/notification-settings",
        { params: { organizationId } },
      );
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useUpdateNotificationSettings(
  organizationId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: Partial<NotificationSettings>) => {
      const { data } = await api.patch<NotificationSettings>(
        "/notification-settings",
        params,
        { params: { organizationId } },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["notification-settings", organizationId],
        data,
      );
    },
  });
}
