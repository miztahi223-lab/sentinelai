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
