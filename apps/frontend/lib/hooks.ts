"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  createdAt: string;
  _count?: { assets: number };
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

export interface Finding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface RiskResult {
  hasScan: boolean;
  scanId?: string;
  scannedAt?: string;
  score: number | null;
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
    }) => {
      const { data } = await api.post<{ url: string }>(
        "/billing/checkout-session",
        params,
      );
      return data;
    },
  });
}

export function useTriggerScan(domainId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/scans", { domainId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk", domainId] });
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
