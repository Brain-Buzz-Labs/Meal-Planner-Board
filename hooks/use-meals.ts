"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormattedMeal } from "@/lib/db/helpers";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.details) message = `${message} — ${body.details}`;
      else if (body?.error) message = `${message} — ${body.error}`;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function useListMeals() {
  return useQuery<FormattedMeal[]>({
    queryKey: ["/api/meals"],
    queryFn: () => fetchJson("/api/meals"),
  });
}

export function useListPastMeals() {
  return useQuery<(FormattedMeal & { ingredients: { id: number; mealId: number; name: string; measurement: string | null; createdAt: string }[] })[]>({
    queryKey: ["/api/meals/past"],
    queryFn: () => fetchJson("/api/meals/past"),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useListDays(startDate: string, count: number) {
  return useQuery<{ date: string; dayOfWeek: string; isToday: boolean }[]>({
    queryKey: ["/api/days", startDate, count],
    queryFn: () => fetchJson(`/api/days?startDate=${startDate}&count=${count}`),
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null; scheduledDate?: string | null; mealType?: string | null }) =>
      fetchJson<FormattedMeal>("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
    },
  });
}

export function useUpdateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string | null; scheduledDate?: string | null; mealType?: string | null; position?: number } }) =>
      fetchJson<FormattedMeal>(`/api/meals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
    },
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<void>(`/api/meals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
    },
  });
}

export function useMoveMeal() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { scheduledDate?: string | null; mealType?: string | null; position: number } }) =>
      fetchJson<FormattedMeal>(`/api/meals/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}
