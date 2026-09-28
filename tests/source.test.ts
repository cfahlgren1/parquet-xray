import { describe, expect, it } from "vitest";
import { resolveUrl } from "../src/lib/parquet/source";
import { fromQuery, toQuery } from "../src/lib/share";

describe("resolveUrl", () => {
  it("turns Hub blob links and hf:// paths into resolve URLs", () => {
    expect(resolveUrl("https://huggingface.co/datasets/a/b/blob/main/x/y.parquet")).toBe(
      "https://huggingface.co/datasets/a/b/resolve/main/x/y.parquet",
    );
    expect(resolveUrl("hf://datasets/openai/gsm8k/main/test.parquet")).toBe(
      "https://huggingface.co/datasets/openai/gsm8k/resolve/main/main/test.parquet",
    );
    expect(resolveUrl("hf://datasets/a/b@refs%2Fconvert%2Fparquet/x.parquet")).toBe(
      "https://huggingface.co/datasets/a/b/resolve/refs%252Fconvert%252Fparquet/x.parquet",
    );
    expect(resolveUrl(" https://example.com/f.parquet ")).toBe("https://example.com/f.parquet");
  });
});

describe("share query", () => {
  it("round-trips the file, row group and column", () => {
    const selection = { url: "hf://datasets/a/b/f.parquet", rg: 3, col: "tags.list.element" };
    expect(fromQuery(toQuery(selection))).toEqual(selection);
  });

  it("ignores a malformed row group", () => {
    expect(fromQuery("?url=x.parquet&rg=abc")).toEqual({ url: "x.parquet", rg: null, col: null });
    expect(fromQuery("?rg=1")).toBeNull();
  });
});
