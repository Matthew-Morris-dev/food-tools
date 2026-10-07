// A recipe's method is stored as plain text; these turn it into steps and back.

// Splits a method into steps: one per line, with any "1." or "Step 2:" numbering removed.
// A single long paragraph is split at the ends of sentences instead.
export function methodSteps(method: string): string[] {
  const lines = method
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, '').trim())
    .filter(Boolean);
  if (lines.length === 1 && lines[0].length > 200) {
    return lines[0]
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return lines;
}

export const stepsToMethod = (steps: string[]) =>
  steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');
