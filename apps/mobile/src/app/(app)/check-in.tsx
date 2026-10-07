import { router } from 'expo-router';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading } from '@/components/ui';
import { today } from '@/lib/dates';
import { fmt } from '@/lib/nutrition';
import { useProgress, useSubmitCheckIn, useUnits } from '@/lib/queries';
import { formatWeight, formatWeightChange } from '@/lib/units';

export default function CheckInScreen() {
  const { weightUnit } = useUnits();
  const { data, isPending, error } = useProgress(today(), '12w');
  const submit = useSubmitCheckIn();

  if (isPending) return <Loading />;
  const checkIn = data?.checkIn;
  if (!data?.goal || !checkIn || (checkIn.status !== 'on_track' && checkIn.status !== 'adjust')) {
    return (
      <FormScreen>
        <ErrorText error={error} />
        <ThemedText themeColor="textSecondary">There&apos;s no check-in to do right now.</ThemedText>
        <Button title="Back to Progress" variant="secondary" onPress={() => router.back()} />
      </FormScreen>
    );
  }

  const done = () => router.dismissTo('/progress');
  const respond = (accept: boolean) => submit.mutate({ date: today(), accept }, { onSuccess: done });
  const rate = (kg: number) => formatWeightChange(kg, weightUnit, ' a week');

  return (
    <FormScreen>
      <Card>
        <ThemedText type="smallBold">Your trend</ThemedText>
        <ThemedText type="subtitle">{formatWeight(checkIn.trendKg, weightUnit)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          A 7-day average, so one heavy or light day doesn&apos;t move it much.
        </ThemedText>
        <ThemedText>Recently: {rate(checkIn.observedRateKg)}</ThemedText>
        <ThemedText>Your plan: {rate(checkIn.plannedRateKg)}</ThemedText>
      </Card>

      {checkIn.status === 'adjust' ? (
        <>
          <Card>
            <ThemedText type="smallBold">Suggested change</ThemedText>
            <ThemedText type="subtitle">{fmt(checkIn.suggestedKcal)} kcal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {checkIn.deltaKcal > 0 ? 'Up' : 'Down'} {fmt(Math.abs(checkIn.deltaKcal))} from {fmt(data.goal.kcal)}.
              Small steps work better than big ones; you can check in again next week.
            </ThemedText>
          </Card>
          <ErrorText error={submit.error} />
          <Button title="Update my targets" onPress={() => respond(true)} loading={submit.isPending} />
          <Button title="Keep my current targets" variant="secondary" onPress={() => respond(false)} disabled={submit.isPending} />
        </>
      ) : (
        <>
          <ThemedText>
            {checkIn.atFloor
              ? 'Your targets are already at the lowest the app plans for, so there is nothing to lower. If your weight has stalled, a break at maintenance or a chat with your GP or a dietitian can help.'
              : "You're on track. No change needed."}
          </ThemedText>
          <ErrorText error={submit.error} />
          <Button title="Got it" onPress={() => respond(false)} loading={submit.isPending} />
        </>
      )}
    </FormScreen>
  );
}
