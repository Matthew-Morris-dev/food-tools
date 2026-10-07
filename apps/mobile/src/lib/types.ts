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

export type WeightPoint = { date: string; weightKg: number; trendKg: number };

export type CheckIn =
  | { status: 'no_goal' }
  | { status: 'not_due'; dueOn: string }
  | { status: 'insufficient'; dueOn: string; message: string; neededWeighIns?: number }
  | { status: 'on_track'; dueOn: string; observedRateKg: number; plannedRateKg: number; trendKg: number; atFloor?: boolean }
  | {
      status: 'adjust';
      dueOn: string;
      observedRateKg: number;
      plannedRateKg: number;
      trendKg: number;
      deltaKcal: number;
      suggestedKcal: number;
    };

export type Progress = {
  goal: Goal | null;
  checkIn: CheckIn;
  weights: WeightPoint[];
  latest: WeightPoint | null;
  changeSinceStartKg: number | null;
  intake: { days: number; avgKcal: number; avgTargetKcal: number } | null;
  proteinHitRate: { hit: number; days: number } | null;
};

export type ProgressRange = '4w' | '12w' | 'all';

export type ExerciseActivity =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'strength'
  | 'hiit'
  | 'yoga'
  | 'sport'
  | 'other';

export type ExerciseEntry = {
  id: string;
  date: string;
  activity: ExerciseActivity;
  minutes: number;
  kcal: number;
};
