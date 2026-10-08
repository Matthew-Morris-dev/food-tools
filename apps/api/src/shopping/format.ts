// The list as plain text, for sharing to a notes app or messages.

export type TextItem = { name: string; amount: string; buy: string | null; ticked: boolean };
export type TextAisle = { aisle: string; items: TextItem[] };

export function shoppingText(title: string, aisles: TextAisle[]): string {
  const lines = [title, ""];
  for (const { aisle, items } of aisles) {
    if (items.length === 0) continue;
    lines.push(aisle);
    for (const item of items) {
      const amount = item.amount ? `${item.amount} ` : "";
      lines.push(`${item.ticked ? "[x]" : "[ ]"} ${amount}${item.name}${item.buy ? ` (buy ${item.buy})` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
