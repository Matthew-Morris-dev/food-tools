import { Chip, ChipRow } from '@/components/ui';
import { SLOTS } from '@/lib/nutrition';
import type { Slot } from '@/lib/types';

export function SlotPicker({ value, onChange }: { value: Slot; onChange: (slot: Slot) => void }) {
  return (
    <ChipRow>
      {SLOTS.map((s) => (
        <Chip key={s.value} label={s.label} selected={s.value === value} onPress={() => onChange(s.value)} />
      ))}
    </ChipRow>
  );
}
