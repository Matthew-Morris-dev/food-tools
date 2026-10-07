// Everything is stored as kg and cm; these convert for display and entry.

export type WeightUnit = 'kg' | 'st_lb' | 'lb';
export type HeightUnit = 'cm' | 'ft_in';

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;
const CM_PER_IN = 2.54;

const round1 = (n: number) => Math.round(n * 10) / 10;
// 12.0 -> "12", 12.5 -> "12.5"
const short = (n: number) => String(round1(n));

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export function kgToStLb(kg: number) {
  let st = Math.floor(kgToLb(kg) / LB_PER_ST);
  let lb = round1(kgToLb(kg) - st * LB_PER_ST);
  if (lb >= LB_PER_ST) {
    st += 1;
    lb = 0;
  }
  return { st, lb };
}

export function formatWeight(kg: number, unit: WeightUnit) {
  if (unit === 'kg') return `${short(kg)} kg`;
  if (unit === 'lb') return `${short(kgToLb(kg))} lb`;
  const { st, lb } = kgToStLb(kg);
  return `${st} st ${short(lb)} lb`;
}

// A change in weight (or a weekly rate), signed; stones aren't used for small changes
export function formatWeightChange(kg: number, unit: WeightUnit, suffix = '') {
  const value = unit === 'kg' ? kg : kgToLb(kg);
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${short(Math.abs(value))} ${unit === 'kg' ? 'kg' : 'lb'}${suffix}`;
}

export function formatHeight(cm: number, unit: HeightUnit) {
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft} ft ${inches} in`;
}

export function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
}

const num = (text: string) => {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n;
};

// Input boxes for each unit: 'kg' -> [kg], 'st_lb' -> [st, lb], 'lb' -> [lb]
export function weightToInputs(kg: number | null, unit: WeightUnit): string[] {
  if (kg === null) return unit === 'st_lb' ? ['', ''] : [''];
  if (unit === 'kg') return [short(kg)];
  if (unit === 'lb') return [short(kgToLb(kg))];
  const { st, lb } = kgToStLb(kg);
  return [String(st), short(lb)];
}

export function weightFromInputs(unit: WeightUnit, inputs: string[]): number | null {
  if (unit === 'kg') return num(inputs[0]);
  if (unit === 'lb') {
    const lb = num(inputs[0]);
    return lb === null ? null : lbToKg(lb);
  }
  const st = num(inputs[0]);
  const lb = inputs[1].trim() === '' ? 0 : num(inputs[1]);
  return st === null || lb === null ? null : lbToKg(st * LB_PER_ST + lb);
}

export function heightToInputs(cm: number | null, unit: HeightUnit): string[] {
  if (cm === null) return unit === 'ft_in' ? ['', ''] : [''];
  if (unit === 'cm') return [String(Math.round(cm))];
  const { ft, inches } = cmToFtIn(cm);
  return [String(ft), String(inches)];
}

export function heightFromInputs(unit: HeightUnit, inputs: string[]): number | null {
  if (unit === 'cm') return num(inputs[0]);
  const ft = num(inputs[0]);
  const inches = inputs[1].trim() === '' ? 0 : num(inputs[1]);
  return ft === null || inches === null ? null : (ft * 12 + inches) * CM_PER_IN;
}
