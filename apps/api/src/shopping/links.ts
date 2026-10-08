// Supermarket links. Search addresses live here in one place: if a supermarket changes
// its site, fixing it is a one-line edit. Checked in a real browser on 8 Oct 2026; the
// supermarkets block scripts, so a change shows up as a search that lands on a home or
// category page rather than results.

export const STORES = {
  tesco: { label: "Tesco", search: "https://www.tesco.com/shop/en-GB/search?query={query}", hosts: ["tesco.com"] },
  sainsburys: { label: "Sainsbury's", search: "https://www.sainsburys.co.uk/groceries/search?searchTerm={query}", hosts: ["sainsburys.co.uk"] },
  ocado: { label: "Ocado", search: "https://www.ocado.com/search?q={query}", hosts: ["ocado.com"] },
} as const;

export type StoreId = keyof typeof STORES;
export const STORE_IDS = Object.keys(STORES) as StoreId[];

export const searchUrl = (store: StoreId, query: string) =>
  STORES[store].search.replace("{query}", encodeURIComponent(query.trim()));

// A saved product link must be an https page on that supermarket's own site, so a link
// pasted from somewhere else (or a look-alike address) can't end up as a "Tesco" button
export function isProductUrl(store: StoreId, raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return STORES[store].hosts.some((h) => url.hostname === h || url.hostname === `www.${h}` || url.hostname.endsWith(`.${h}`));
}
