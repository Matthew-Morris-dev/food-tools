// Builds data/cofid.json from the McCance and Widdowson CoFID 2021 workbook.
// Contains public sector information licensed under the Open Government Licence v3.0.
// Run: npm run build:cofid -w apps/api
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import ExcelJS from "exceljs";

const SOURCE_URL =
  "https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx";
const CACHE = new URL("../../../.cache/cofid.xlsx", import.meta.url).pathname;
const OUT = new URL("../data/cofid.json", import.meta.url).pathname;

// CoFID marks trace amounts "Tr" and unknown-but-present values "N"
function num(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined || value === "N" || value === "") return null;
  if (value === "Tr") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

if (!existsSync(CACHE)) {
  console.log("Downloading CoFID workbook…");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(CACHE);

function sheetRows(name: string) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet ${name} not found`);
  // row.values is a sparse array starting at index 1
  const headers = Array.from(ws.getRow(1).values as ExcelJS.CellValue[], (h) => String(h ?? "").trim());
  const rows: Record<string, ExcelJS.CellValue>[] = [];
  ws.eachRow((row, i) => {
    if (i < 4) return; // three header rows
    const values = row.values as ExcelJS.CellValue[];
    rows.push(Object.fromEntries(headers.map((h, col) => [h, values[col] ?? null])));
  });
  return rows;
}

const sodiumByName = new Map(sheetRows("1.4 Inorganics").map((r) => [r["Food Name"], num(r["Sodium (mg)"])]));

const foods = sheetRows("1.3 Proximates")
  .map((r) => {
    const sodiumMg = sodiumByName.get(r["Food Name"]) ?? null;
    return {
      code: String(r["Food Code"]),
      name: String(r["Food Name"]).trim(),
      kcal: num(r["Energy (kcal) (kcal)"]),
      protein: num(r["Protein (g)"]) ?? 0,
      carbs: num(r["Carbohydrate (g)"]) ?? 0,
      fat: num(r["Fat (g)"]) ?? 0,
      sugars: num(r["Total sugars (g)"]),
      // UK labels use AOAC fibre; older CoFID entries only have NSP, which reads a little lower
      fibre: num(r["AOAC fibre (g)"]) ?? num(r["NSP (g)"]),
      saturates: num(r["Satd FA /100g fd (g)"]),
      salt: sodiumMg === null ? null : Math.round(sodiumMg * 2.5) / 1000,
    };
  })
  .filter((f) => f.kcal !== null);

// A few codes are reused in the 2021 dataset (e.g. 13-669 is both aubergine and
// watercress), so later duplicates get a suffix to keep IDs unique
const seen = new Map<string, number>();
for (const f of foods) {
  const n = (seen.get(f.code) ?? 0) + 1;
  seen.set(f.code, n);
  if (n > 1) f.code = `${f.code}-${n}`;
}

writeFileSync(OUT, JSON.stringify(foods) + "\n");
console.log(`Wrote ${foods.length} foods to ${OUT}`);
