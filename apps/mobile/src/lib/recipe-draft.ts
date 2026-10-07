import type { RecipeIngredient, RecipeInput } from './types';

// An unsaved recipe handed to the editor, e.g. from an import
export type Draft = Omit<RecipeInput, 'ingredients'> & {
  ingredients: (Omit<RecipeIngredient, 'id' | 'kcal'> & { alternatives?: import('./types').Food[]; warning?: string })[];
  warnings?: string[];
  siteNutrition?: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
};

let draft: Draft | null = null;

export const setDraft = (next: Draft | null) => {
  draft = next;
};

export function takeDraft() {
  const current = draft;
  draft = null;
  return current;
}
