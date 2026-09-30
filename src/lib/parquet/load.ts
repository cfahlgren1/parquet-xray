import { parquetMetadataAsync } from "hyparquet";
import { buildModel, readIndexes, type ParquetModel } from "./model";
import { tailBuffer, type ReadCounter, type Source } from "./source";

export interface Loaded {
  model: ParquetModel;
  counter: ReadCounter;
}

/** Reads the footer and page indexes of a Parquet file and lays out every byte range. */
export async function loadParquet(name: string, open: () => Promise<Source>): Promise<Loaded> {
  const { file, counter } = tailBuffer(await open());
  // hyparquet would otherwise copy GEOMETRY types from the `geo` key into the schema; show what the footer declares.
  const metadata = await parquetMetadataAsync(file, { geoparquet: false });
  const indexes = await readIndexes(file, metadata);
  return { model: buildModel(name, file.byteLength, metadata, indexes), counter };
}

/** A sentence saying why a file couldn't be read, for the status line. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError && /fetch/i.test(message)) {
    return "the request was blocked. Check the URL, and that the server allows cross-origin (CORS) range requests.";
  }
  if (/PAR1|footer|metadata/i.test(message)) return `this doesn't look like a Parquet file (${message}).`;
  return message;
}
