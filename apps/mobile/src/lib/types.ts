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

export type SavedMealItem = {
  id: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type SavedMeal = { id: string; name: string; items: SavedMealItem[] };

export type Sex = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain' | 'build';

export type Profile = {
  userId: string;
  birthYear: number;
  sex: Sex;
  heightCm: number;
  activityLevel: ActivityLevel;
  weightUnit: 'kg' | 'st_lb' | 'lb';
  heightUnit: 'cm' | 'ft_in';
};

export type Targets = { kcal: number; protein: number; carbs: number; fat: number };

export type Goal = Targets & {
  id: string;
  type: GoalType;
  ratePerWeekKg: number;
  startWeightKg: number;
  targetWeightKg: number | null;
  manual: boolean;
  trainingWeekdays: number[];
  trainingDayExtraKcal: number;
  exerciseAddsToAllowance: boolean;
  activeFrom: string;
};

export type SetupInput = {
  date: string;
  profile: { birthYear: number; sex: Sex; heightCm: number; activityLevel: ActivityLevel };
  weightKg: number;
  goal: { type: GoalType; ratePerWeekKg: number; targetWeightKg?: number | null };
  trainingWeekdays: number[];
  trainingDayExtraKcal: number;
  exerciseAddsToAllowance: boolean;
  manual?: (Targets & { acknowledgeBelowFloor: boolean }) | null;
};

export type GoalPlan = {
  targets: Targets;
  calculated: Targets;
  tdee: number;
  actualRatePerWeekKg: number;
  rateCapped: boolean;
  floorKcal: number;
  floorApplied: boolean;
  belowFloor: boolean;
  manual: boolean;
  weeksToTarget: number | null;
};

export type DayTargets = {
  goalId: string;
  type: GoalType;
  base: Targets;
  targets: Targets;
  hasSchedule: boolean;
  trainingDay: boolean;
  trainingExtraKcal: number;
  exerciseKcal: number;
  exerciseAddsToAllowance: boolean;
};
