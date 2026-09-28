export const SPACE_URL = "https://huggingface.co/spaces/cfahlgren1/parquet-xray";
const HUB_ORIGIN = "https://huggingface.co";

export interface Selection {
  url: string;
  rg: number | null;
  col: string | null;
}

export function toQuery({ url, rg, col }: Selection): string {
  const params = new URLSearchParams({ url });
  if (rg !== null) params.set("rg", String(rg));
  if (col !== null) params.set("col", col);
  return params.toString();
}

export function fromQuery(search: string): Selection | null {
  const params = new URLSearchParams(search);
  const url = params.get("url");
  if (!url) return null;
  const rg = params.get("rg");
  return { url, rg: rg !== null && /^\d+$/.test(rg) ? Number(rg) : null, col: params.get("col") };
}

/** Links to the Space page when running inside it, since the bare *.hf.space URL has no Hub header. */
export function shareUrl(query: string, location: Location): string {
  const base = location.hostname.endsWith(".hf.space") ? SPACE_URL : `${location.origin}${location.pathname}`;
  return `${base}?${query}`;
}

/** Mirrors the query into this page's URL and, on huggingface.co, into the Space page's URL around the iframe. */
export function publishQuery(query: string): void {
  history.replaceState(null, "", `?${query}`);
  if (window.parent !== window) window.parent.postMessage({ queryString: query }, HUB_ORIGIN);
}
