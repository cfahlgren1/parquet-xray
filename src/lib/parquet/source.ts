import type { AsyncBuffer } from "hyparquet";

/** One suffix request returns the file size, the footer and usually the page indexes. */
const TAIL_BYTES = 512 * 1024;

/** A readable Parquet file whose last bytes were already fetched. */
export interface Source {
  byteLength: number;
  tail: ArrayBuffer;
  /** Requests it took to fetch the tail. */
  requests: number;
  read(start: number, end: number): Promise<ArrayBuffer>;
}

export interface ReadCounter {
  bytes: number;
  requests: number;
}

/** Turns Hub `blob` links and `hf://` paths into URLs that serve raw bytes. */
export function resolveUrl(input: string): string {
  const s = input.trim();
  const hf = s.match(/^hf:\/\/(datasets|spaces|models)?\/?([^/]+\/[^/@]+)(?:@([^/]+))?\/(.+)$/);
  if (hf) {
    const [, type = "datasets", repo, rev = "main", path] = hf;
    const prefix = type === "models" ? "" : `${type}/`;
    return `https://huggingface.co/${prefix}${repo}/resolve/${encodeURIComponent(rev)}/${path}`;
  }
  return s.replace(/^(https:\/\/huggingface\.co\/.+?)\/blob\//, "$1/resolve/");
}

export async function urlSource(url: string): Promise<Source> {
  const fetchRange = async (range: string) => {
    const res = await fetch(url, { headers: { Range: `bytes=${range}` } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || "request failed"}`);
    return res;
  };
  const read = async (start: number, end: number) => (await fetchRange(`${start}-${end - 1}`)).arrayBuffer();
  const res = await fetchRange(`-${TAIL_BYTES}`);
  const tail = await res.arrayBuffer();
  // A 200 means the server ignored Range and sent the whole (small) file.
  if (res.status !== 206) return { byteLength: tail.byteLength, tail, requests: 1, read };
  const range = res.headers.get("content-range")?.match(/bytes (\d+)-(\d+)\/(\d+)/);
  if (!range) throw new Error("the server sent a partial response without a Content-Range header");
  const [, , last, total] = range.map(Number) as [number, number, number, number];
  if (last + 1 === total) return { byteLength: total, tail, requests: 1, read };
  // Some servers answer a suffix range with the start of the file; ask for the tail by offset instead.
  const start = Math.max(0, total - TAIL_BYTES);
  return { byteLength: total, tail: await read(start, total), requests: 2, read };
}

export async function fileSource(file: Blob): Promise<Source> {
  const read = (start: number, end: number) => file.slice(start, end).arrayBuffer();
  return { byteLength: file.size, tail: await read(Math.max(0, file.size - TAIL_BYTES), file.size), requests: 1, read };
}

/** Serves reads inside the prefetched tail from memory and counts the rest. */
export function tailBuffer({ byteLength, tail, requests, read }: Source): { file: AsyncBuffer; counter: ReadCounter } {
  const tailStart = byteLength - tail.byteLength;
  const counter = { bytes: tail.byteLength, requests };
  const file: AsyncBuffer = {
    byteLength,
    slice: async (start, end = byteLength) => {
      if (start >= tailStart) return tail.slice(start - tailStart, end - tailStart);
      const result = await read(start, end);
      counter.bytes += result.byteLength;
      counter.requests += 1;
      return result;
    },
  };
  return { file, counter };
}
