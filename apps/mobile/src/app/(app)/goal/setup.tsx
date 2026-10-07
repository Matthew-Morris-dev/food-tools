import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { HeightInput, WeightInput } from '@/components/unit-inputs';
import { Button, Card, Chip, ChipRow, ErrorText, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, today } from '@/lib/dates';
import { fmt, parseNumber } from '@/lib/nutrition';
import { useCurrentGoal, useGoalPreview, useProfile, useSaveGoal, useSetUnits } from '@/lib/queries';
import type { ActivityLevel, Goal, GoalPlan, GoalType, Profile, SetupInput, Sex } from '@/lib/types';
import { formatWeightChange, type HeightUnit, type WeightUnit } from '@/lib/units';

const GOALS: { value: GoalType; label: string; hint: string }[] = [
  { value: 'lose', label: 'Lose weight', hint: 'A steady deficit. Capped at about 1% of bodyweight a week.' },
  { value: 'maintain', label: 'Maintain', hint: 'Eat at your estimated needs.' },
  { value: 'gain', label: 'Gain weight', hint: 'A small surplus.' },
  { value: 'build', label: 'Build muscle', hint: 'A slow surplus with higher protein.' },
];

const RATES: Record<GoalType, number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  maintain: [0],
  gain: [0.25, 0.5],
  build: [0.1, 0.25],
};

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Mostly sitting' },
  { value: 'light', label: 'Light (1–3 days)' },
  { value: 'moderate', label: 'Moderate (3–5 days)' },
  { value: 'active', label: 'Active (6–7 days)' },
  { value: 'very_active', label: 'Very active' },
];

const SEXES: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GoalSetupScreen() {
  const profile = useProfile();
  const goal = useCurrentGoal(today());
  if (profile.isPending || goal.isPending) return null;
  return <GoalForm profile={profile.data ?? null} goal={goal.data ?? null} />;
}

function GoalForm({ profile, goal }: { profile: Profile | null; goal: Goal | null }) {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile?.weightUnit ?? 'kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(profile?.heightUnit ?? 'cm');

  const [birthYear, setBirthYear] = useState(profile ? String(profile.birthYear) : '');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'unspecified');
  const [heightCm, setHeightCm] = useState<number | null>(profile?.heightCm ?? null);
  const [weightKg, setWeightKg] = useState<number | null>(goal?.startWeightKg ?? null);
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activityLevel ?? 'light');

  const [type, setType] = useState<GoalType>(goal?.type ?? 'lose');
  const [rate, setRate] = useState(goal?.ratePerWeekKg ?? 0.5);
  const [targetKg, setTargetKg] = useState<number | null>(goal?.targetWeightKg ?? null);

  const [weekdays, setWeekdays] = useState<number[]>(goal?.trainingWeekdays ?? []);
  const [extraText, setExtraText] = useState(String(goal?.trainingDayExtraKcal ?? 200));
  const [exerciseAdds, setExerciseAdds] = useState(goal?.exerciseAddsToAllowance ?? false);

  const [manualOn, setManualOn] = useState(goal?.manual ?? false);
  const [manualText, setManualText] = useState({
    kcal: String(goal?.kcal ?? ''),
    protein: String(goal?.protein ?? ''),
    carbs: String(goal?.carbs ?? ''),
    fat: String(goal?.fat ?? ''),
  });
  const [acknowledged, setAcknowledged] = useState(false);

  const changeType = (next: GoalType) => {
    setType(next);
    if (!RATES[next].includes(rate)) setRate(next === 'maintain' ? 0 : RATES[next][Math.min(1, RATES[next].length - 1)]);
  };

  const year = parseNumber(birthYear);
  const manual = manualOn
    ? {
        kcal: parseNumber(manualText.kcal),
        protein: parseNumber(manualText.protein),
        carbs: parseNumber(manualText.carbs),
        fat: parseNumber(manualText.fat),
      }
    : null;
  const manualValid = manual === null || Object.values(manual).every((v) => v !== null && v >= 0);

  const input: SetupInput | null = (() => {
    if (!year || year < 1900 || year > new Date().getFullYear() - 13) return null;
    if (!heightCm || heightCm < 100 || heightCm > 250 || !weightKg || weightKg < 30 || weightKg > 400) return null;
    if (!manualValid) return null;
    return {
      date: today(),
      profile: { birthYear: year, sex, heightCm, activityLevel: activity },
      weightKg,
      goal: { type, ratePerWeekKg: rate, targetWeightKg: targetKg },
      trainingWeekdays: weekdays,
      trainingDayExtraKcal: parseNumber(extraText) ?? 0,
      exerciseAddsToAllowance: exerciseAdds,
      manual: manual
        ? {
            kcal: manual.kcal!,
            protein: manual.protein!,
            carbs: manual.carbs!,
            fat: manual.fat!,
            acknowledgeBelowFloor: acknowledged,
          }
        : null,
    };
  })();

  const preview = useGoalPreview(input);
  const plan = preview.data;

  // Fill the manual boxes from the calculation the first time the switch is turned on
  const toggleManual = (on: boolean) => {
    setManualOn(on);
    if (on && manualText.kcal === '' && plan) {
      setManualText({
        kcal: String(plan.calculated.kcal),
        protein: String(plan.calculated.protein),
        carbs: String(plan.calculated.carbs),
        fat: String(plan.calculated.fat),
      });
    }
  };

  const save = useSaveGoal();
  const setUnits = useSetUnits();
  const submit = () => {
    if (!input) return;
    save.mutate(input, {
      onSuccess: () => {
        if (weightUnit !== (profile?.weightUnit ?? 'kg') || heightUnit !== (profile?.heightUnit ?? 'cm')) {
          setUnits.mutate({ weightUnit, heightUnit });
        }
        router.dismissTo('/progress');
      },
    });
  };

  const toggleDay = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));

  const blocked = plan?.belowFloor && !acknowledged;

  return (
    <FormScreen>
      <ThemedText type="small" themeColor="textSecondary">
        These are estimates to start from, not medical advice. If you have a health condition or work with a coach or
        dietitian, follow their numbers and set them manually below.
      </ThemedText>

      <Section title="Units">
        <ChipRow>
          {(['kg', 'st_lb', 'lb'] as const).map((u) => (
            <Chip key={u} label={{ kg: 'kg', st_lb: 'st + lb', lb: 'lb' }[u]} selected={weightUnit === u} onPress={() => setWeightUnit(u)} />
          ))}
        </ChipRow>
        <ChipRow>
          {(['cm', 'ft_in'] as const).map((u) => (
            <Chip key={u} label={u === 'cm' ? 'cm' : 'ft + in'} selected={heightUnit === u} onPress={() => setHeightUnit(u)} />
          ))}
        </ChipRow>
      </Section>

      <Section title="About you">
        <TextField label="Year of birth" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" maxLength={4} />
        <ThemedText type="small" themeColor="textSecondary">
          Sex is only used in the energy estimate.
        </ThemedText>
        <ChipRow>
          {SEXES.map((s) => (
            <Chip key={s.value} label={s.label} selected={sex === s.value} onPress={() => setSex(s.value)} />
          ))}
        </ChipRow>
        <HeightInput key={`h-${heightUnit}`} unit={heightUnit} initialCm={heightCm} onChangeCm={setHeightCm} />
        <WeightInput key={`w-${weightUnit}`} label="Weight now" unit={weightUnit} initialKg={weightKg} onChangeKg={setWeightKg} />
        <ThemedText type="small" themeColor="textSecondary">
          Activity outside planned exercise
        </ThemedText>
        <ChipRow>
          {ACTIVITY.map((a) => (
            <Chip key={a.value} label={a.label} selected={activity === a.value} onPress={() => setActivity(a.value)} />
          ))}
        </ChipRow>
      </Section>

      <Section title="Goal">
        <ChipRow>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={type === g.value} onPress={() => changeType(g.value)} />
          ))}
        </ChipRow>
        <ThemedText type="small" themeColor="textSecondary">
          {GOALS.find((g) => g.value === type)!.hint}
        </ThemedText>
        {type !== 'maintain' && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Pace per week
            </ThemedText>
            <ChipRow>
              {RATES[type].map((r) => (
                <Chip
                  key={r}
                  label={`${formatWeightChange(r, weightUnit === 'kg' ? 'kg' : 'lb').replace(/^\+/, '')}`}
                  selected={rate === r}
                  onPress={() => setRate(r)}
                />
              ))}
            </ChipRow>
          </>
        )}
        {type !== 'maintain' && (
          <WeightInput key={`t-${weightUnit}`} label="Target weight (optional)" unit={weightUnit} initialKg={targetKg} onChangeKg={setTargetKg} />
        )}
      </Section>

      <Section title="Training days (optional)">
        <ThemedText type="small" themeColor="textSecondary">
          Eat a bit more on the days you train. You can switch any day from Today.
        </ThemedText>
        <ChipRow>
          {WEEKDAYS.map((label, i) => (
            <Chip key={label} label={label} selected={weekdays.includes(i + 1)} onPress={() => toggleDay(i + 1)} />
          ))}
        </ChipRow>
        {weekdays.length > 0 && (
          <TextField label="Extra calories on training days" value={extraText} onChangeText={setExtraText} keyboardType="decimal-pad" />
        )}
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText>Add logged exercise to my allowance</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Off by default. If you use training days above, leave this off so exercise isn&apos;t counted twice.
            </ThemedText>
          </View>
          <Switch value={exerciseAdds} onValueChange={setExerciseAdds} />
        </View>
      </Section>

      <Section title="Your targets">
        {plan ? (
          <PlanSummary plan={plan} weightUnit={weightUnit} manualOn={manualOn} />
        ) : (
          <ThemedText themeColor="textSecondary">Fill in the sections above to see your targets.</ThemedText>
        )}
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText>Set targets manually</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              For example, numbers from a coach or dietitian.
            </ThemedText>
          </View>
          <Switch value={manualOn} onValueChange={toggleManual} />
        </View>
        {manualOn && (
          <>
            <TextField label="Calories (kcal)" value={manualText.kcal} onChangeText={(v) => setManualText({ ...manualText, kcal: v })} keyboardType="decimal-pad" />
            <View style={styles.row}>
              <TextField label="Protein (g)" value={manualText.protein} onChangeText={(v) => setManualText({ ...manualText, protein: v })} keyboardType="decimal-pad" />
              <TextField label="Carbs (g)" value={manualText.carbs} onChangeText={(v) => setManualText({ ...manualText, carbs: v })} keyboardType="decimal-pad" />
              <TextField label="Fat (g)" value={manualText.fat} onChangeText={(v) => setManualText({ ...manualText, fat: v })} keyboardType="decimal-pad" />
            </View>
            {plan?.belowFloor && (
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <ThemedText>This is below {fmt(plan.floorKcal)} kcal</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    That&apos;s lower than is usually advised without medical supervision. I understand and want to use
                    it anyway.
                  </ThemedText>
                </View>
                <Switch value={acknowledged} onValueChange={setAcknowledged} />
              </View>
            )}
          </>
        )}
      </Section>

      <ErrorText error={save.error ?? preview.error} />
      <Button title="Save goal" onPress={submit} disabled={!input || !plan || blocked} loading={save.isPending} />
    </FormScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

function PlanSummary({ plan, weightUnit, manualOn }: { plan: GoalPlan; weightUnit: WeightUnit; manualOn: boolean }) {
  const shown = manualOn ? plan.calculated : plan.targets;
  const rateUnit = weightUnit === 'kg' ? 'kg' : 'lb';
  const weeks = plan.weeksToTarget;
  return (
    <Card>
      <ThemedText type="subtitle">{fmt(shown.kcal)} kcal</ThemedText>
      <View style={styles.macros}>
        {(
          [
            ['Protein', shown.protein],
            ['Carbs', shown.carbs],
            ['Fat', shown.fat],
          ] as const
        ).map(([label, g]) => (
          <View key={label}>
            <ThemedText type="smallBold">{fmt(g)} g</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Estimated needs {fmt(plan.tdee)} kcal a day
        {plan.actualRatePerWeekKg > 0 && `, about ${formatWeightChange(plan.actualRatePerWeekKg, rateUnit).replace(/^\+/, '')} a week`}.
      </ThemedText>
      {plan.rateCapped && (
        <ThemedText type="small" themeColor="textSecondary">
          Your pace was reduced to stay within about 1% of bodyweight a week.
        </ThemedText>
      )}
      {plan.floorApplied && (
        <ThemedText type="small" themeColor="textSecondary">
          Targets don&apos;t go below {fmt(plan.floorKcal)} kcal a day, so your pace is slower than the one you picked.
        </ThemedText>
      )}
      {weeks !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          At this pace, about {weeks} {weeks === 1 ? 'week' : 'weeks'} to your target (around{' '}
          {new Date(`${addDays(today(), weeks * 7)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  macros: { flexDirection: 'row', gap: Spacing.five },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.half },
});
