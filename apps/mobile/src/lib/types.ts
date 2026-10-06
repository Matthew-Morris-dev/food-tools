export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Serving = { label: string; grams: number };

export type Food = {
  id: string;
  source: 'cofid' | 'off' | 'custom';
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  fibre: number | null;
  saturates: number | null;
  salt: number | null;
  servings: Serving[];
};

export type LogEntry = {
  id: string;
  date: string;
  slot: Slot;
  status: 'planned' | 'eaten';
  foodId: string | null;
  name: string;
  brand: string | null;
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
};

export type BarcodeResult =
  | { status: 'found'; food: Food }
  | { status: 'incomplete'; name: string | null; brand: string | null }
  | { status: 'not_found' };

export type NewCustomFood = Omit<Food, 'id' | 'source'>;
