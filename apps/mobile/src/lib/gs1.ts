// Pulls the product number (GTIN) out of anything the scanner reads:
// - linear barcodes (EAN-13, EAN-8, UPC-A, UPC-E): already just the number
// - GS1 Digital Link QR codes: https://id.gs1.org/01/05000157024671/10/ABC?17=261231
// - GS1 element strings from DataMatrix or QR codes: ]d2 01 05000157024671 17 261231 ...
// Returns a GTIN in the form Open Food Facts uses (EAN-13 rather than GTIN-14), or
// null when the code isn't a product code.

const GS = '\u001d'; // FNC1 separator in element strings

function validCheckDigit(gtin: string) {
  const digits = gtin.split('').map(Number);
  const check = digits.pop()!;
  // Weights alternate 3, 1, 3 ... starting from the digit next to the check digit
  const total = digits.reverse().reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === check;
}

function normalise(gtin: string): string | null {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin) || !validCheckDigit(gtin)) return null;
  // A GTIN-14 with a leading zero is the same product as the EAN-13 without it
  return gtin.length === 14 && gtin.startsWith('0') ? gtin.slice(1) : gtin;
}

function fromDigitalLink(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  // The GTIN follows the "01" path segment; any domain and path prefix are allowed
  const segments = url.pathname.split('/').filter(Boolean);
  const i = segments.lastIndexOf('01');
  return i >= 0 && i + 1 < segments.length ? normalise(decodeURIComponent(segments[i + 1])) : null;
}

function fromElementString(text: string): string | null {
  // Drop a symbology identifier (]d2, ]Q3, ]C1, ...) and brackets from the human-readable form
  const raw = text.replace(/^\][A-Za-z]\d/, '').replace(/^\u001d/, '');
  const bracketed = raw.match(/\(01\)(\d{14})/);
  if (bracketed) return normalise(bracketed[1]);
  // AI 01 is fixed length, so when present it is usually first
  const plain = raw.split(GS)[0].match(/^01(\d{14})/);
  return plain ? normalise(plain[1]) : null;
}

export function gtinFromScan(data: string): string | null {
  const text = data.trim();
  // Plain numbers come from linear barcodes the scanner has already verified (and UPC-E
  // check digits work differently), so they skip the check-digit test
  if (/^\d{6,14}$/.test(text)) return text.length === 14 && text.startsWith('0') ? text.slice(1) : text;
  if (/^https?:\/\//i.test(text)) return fromDigitalLink(text);
  return fromElementString(text);
}
