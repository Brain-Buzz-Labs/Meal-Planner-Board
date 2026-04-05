export interface WeeklyIngredient {
  id: number;
  mealId: number;
  mealName: string;
  name: string;
  measurement: string | null;
}

export interface AggregatedIngredient {
  name: string;
  entries: { quantity: number | null; unit: string; display: string }[];
}

function parseMeasurement(measurement: string | null): { quantity: number | null; unit: string } {
  if (!measurement || !measurement.trim()) {
    return { quantity: null, unit: "" };
  }

  const trimmed = measurement.trim();
  const match = trimmed.match(/^([\d]+(?:\.[\d]+)?(?:\s*\/\s*[\d]+(?:\.[\d]+)?)?)\s*(.*)$/);

  if (!match) {
    return { quantity: null, unit: trimmed.toLowerCase() };
  }

  const numStr = match[1];
  const unit = match[2].trim().toLowerCase();

  let quantity: number;
  if (numStr.includes("/")) {
    const [num, den] = numStr.split("/").map((s) => parseFloat(s.trim()));
    quantity = den !== 0 ? num / den : 0;
  } else {
    quantity = parseFloat(numStr);
  }

  if (isNaN(quantity)) {
    return { quantity: null, unit: trimmed.toLowerCase() };
  }

  return { quantity, unit };
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function aggregateIngredients(ingredients: WeeklyIngredient[]): AggregatedIngredient[] {
  const groups = new Map<string, WeeklyIngredient[]>();

  for (const ingredient of ingredients) {
    const key = ingredient.name.trim().toLowerCase();
    const group = groups.get(key) || [];
    group.push(ingredient);
    groups.set(key, group);
  }

  const result: AggregatedIngredient[] = [];

  for (const [, group] of groups) {
    const displayName = group[0].name;
    const parsed = group.map((g) => ({ ...parseMeasurement(g.measurement), original: g.measurement }));

    // Sub-group by unit
    const unitGroups = new Map<string, { quantities: number[]; unparsed: string[] }>();

    for (const p of parsed) {
      const unitKey = p.unit;
      const ug = unitGroups.get(unitKey) || { quantities: [], unparsed: [] };
      if (p.quantity !== null) {
        ug.quantities.push(p.quantity);
      } else if (p.original) {
        ug.unparsed.push(p.original);
      }
      unitGroups.set(unitKey, ug);
    }

    const entries: AggregatedIngredient["entries"] = [];

    for (const [unit, ug] of unitGroups) {
      if (ug.quantities.length > 0) {
        const total = ug.quantities.reduce((sum, q) => sum + q, 0);
        const display = unit ? `${formatQuantity(total)} ${unit}` : formatQuantity(total);
        entries.push({ quantity: total, unit, display });
      }
      for (const raw of ug.unparsed) {
        entries.push({ quantity: null, unit, display: raw });
      }
    }

    // If no measurements at all, show just the count
    if (entries.length === 0) {
      const count = group.length;
      entries.push({ quantity: count, unit: "", display: count > 1 ? `${count}` : "" });
    }

    result.push({ name: displayName, entries });
  }

  result.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return result;
}
