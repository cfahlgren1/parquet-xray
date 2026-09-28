import { readFile } from "node:fs/promises";
import { loadParquet, type Loaded } from "../src/lib/parquet/load";
import { fileSource } from "../src/lib/parquet/source";

export async function loadFixture(path: string): Promise<Loaded> {
  const bytes = await readFile(path);
  return loadParquet(path.split("/").pop() ?? path, () => fileSource(new Blob([bytes])));
}
