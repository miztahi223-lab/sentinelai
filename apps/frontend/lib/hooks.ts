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
