// MET values (Compendium of Physical Activities, rounded). kcal = (MET - 1) × kg × hours,
// which counts only the calories above resting.
export const ACTIVITIES = {
  walking: { label: "Walking", met: 3.5 },
  running: { label: "Running", met: 9.8 },
  cycling: { label: "Cycling", met: 7.5 },
  swimming: { label: "Swimming", met: 6 },
  strength: { label: "Strength training", met: 5 },
  hiit: { label: "HIIT", met: 8 },
  yoga: { label: "Yoga", met: 2.8 },
  sport: { label: "Sport", met: 7 },
  other: { label: "Other", met: 5 },
} as const;

export type Activity = keyof typeof ACTIVITIES;

export function estimateKcal(activity: Activity, minutes: number, weightKg: number) {
  return Math.round((ACTIVITIES[activity].met - 1) * weightKg * (minutes / 60));
}
