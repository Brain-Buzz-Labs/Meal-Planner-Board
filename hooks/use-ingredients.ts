"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WeeklyIngredient } from "@/lib/aggregate-ingredients";

export interface FormattedIngredient {
  id: number;
  mealId: number;
  name: string;
  measurement: string | null;
  createdAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function useListIngredients(mealId: number, enabled: boolean) {
  return useQuery<FormattedIngredient[]>({
    queryKey: ["/api/meals", mealId, "ingredients"],
    queryFn: () => fetchJson(`/api/meals/${mealId}/ingredients`),
    enabled,
  });
}

export function useWeeklyIngredients(startDate: string, endDate: string) {
  return useQuery<WeeklyIngredient[]>({
    queryKey: ["/api/ingredients/weekly", startDate, endDate],
    queryFn: () => fetchJson(`/api/ingredients/weekly?startDate=${startDate}&endDate=${endDate}`),
  });
}

export function useCreateIngredient(mealId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; measurement?: string | null }) =>
      fetchJson<FormattedIngredient>(`/api/meals/${mealId}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals", mealId, "ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
    },
  });
}

export function useDeleteIngredient(mealId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ingredientId: number) =>
      fetchJson<void>(`/api/meals/${mealId}/ingredients/${ingredientId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals", mealId, "ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
    },
  });
}

export async function createIngredientDirect(mealId: number, data: { name: string; measurement?: string | null }) {
  return fetchJson<FormattedIngredient>(`/api/meals/${mealId}/ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
