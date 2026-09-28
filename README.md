---
title: Parquet X-ray
emoji: 🔬
colorFrom: indigo
colorTo: gray
sdk: static
app_build_command: npm run build
app_file: dist/index.html
pinned: false
license: apache-2.0
short_description: See how a Parquet file is laid out, byte by byte
tags:
  - parquet
  - visualization
  - hyparquet
---

# Parquet X-ray

See how a Parquet file is laid out on disk: its row groups, column chunks, dictionary and data pages, page indexes, bloom filters and footer. Paste a URL and hover around.

It only downloads the footer and the page indexes, so a 2 GB file opens after reading about 3 MB.

![A row group opened, with a data page's details in a popover](https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/desktop-row-group-page.png)

## Try it

Paste any of these into the input:

| Input                                   | Example                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hub file URL                            | `https://huggingface.co/datasets/openai/gsm8k/blob/main/main/test-00000-of-00001.parquet` |
| `hf://` path                            | `hf://datasets/openai/gsm8k/main/test-00000-of-00001.parquet`                             |
| Any URL that allows CORS range requests | `https://example.com/data.parquet`                                                        |
| A local file                            | **Open file**, or drop it on the page. It never leaves your browser.                      |

Links are shareable: the open row group and column are kept in the URL, and **Copy link** copies it, e.g. [`?url=hf://…gsm8k…&rg=0&col=answer`](https://huggingface.co/spaces/cfahlgren1/parquet-xray?url=hf%3A%2F%2Fdatasets%2Fopenai%2Fgsm8k%2Fmain%2Ftest-00000-of-00001.parquet&rg=0&col=answer).

## What you're looking at

**File.** Each row group is shown at its position and size in the file. Each column has its own color: a pale block is the column's dictionary page and the stronger blocks after it are its data pages, split by thin lines at page boundaries. On wide files, each pixel takes the color of the column with the most bytes under it. Selecting a column in the schema greys out every other column. The page indexes and footer at the end are tiny, so they're magnified on the right. Hover any page for its column, byte range, rows and min/max, and click to open its row group.

**Row groups.** One row per row group with its rows, size and a bar split by column. Click one (here or in the file strip, they stay in sync) to expand every column chunk as a strip of its pages, with its size, page count and min/max.

**Schema.** The Parquet schema with each column's size on disk. List columns are folded onto one line, so a `list<list<double>>` reads `double[][]` instead of taking nine lines. Click a column to see its min/max, nulls and size in every row group, with a range bar per row group: a sorted column climbs like a staircase, an unsorted one overlaps.

**Read efficiency.** Badges for what the footer says about how cheaply a reader can filter. Hover (or tap) one for the explanation:

- **Sorted:** a column whose min/max ranges don't overlap between row groups (for example, sorted by time), so range filters skip row groups.
- **Page index:** readers can seek to a single page and skip pages by min/max.
- **Bloom:** `=` and `IN` lookups can skip row groups.
- **CDC:** pages are cut at content boundaries, so edited versions dedupe well on Xet.

| Clicking a column                                                                                                                                                 | Magnified indexes and footer                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ![ts clicked in the schema, showing min/max per row group](https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/desktop-column-selected.png) | ![Hovering a column index](https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/desktop-hover-index.png) |

### A real example: fineweb-edu

A 2 GB fineweb-edu shard has 726 row groups of 1,000 rows each and no page index. Opening a row group shows that almost all of its bytes are one dictionary page for `text`: pyarrow put every document into the dictionary before its size limit kicked in.

![fineweb-edu shard with a row group open](https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/desktop-fineweb.png)

## On mobile

Everything stacks into one column. Tapping a column lists its row groups right under it, and tapping a page opens its details as a bottom sheet.

<p>
  <img src="https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/mobile-overview.png" width="32%" alt="Mobile overview">
  <img src="https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/mobile-column.png" width="32%" alt="Mobile column with min/max per row group">
  <img src="https://huggingface.co/spaces/cfahlgren1/parquet-xray/resolve/main/assets/mobile-page-popover.png" width="32%" alt="Mobile page details">
</p>

## How it stays fast

The first request asks for the last 512 KB of the file with a suffix range (`Range: bytes=-524288`). That one response carries the file size, the footer and, for most files, the page indexes. A footer larger than 512 KB takes a second request, and nothing else is fetched.

| File                               | Size   | Downloaded | Requests |
| ---------------------------------- | ------ | ---------- | -------- |
| sensors (page index, bloom filter) | 4.7 MB | 512 KB     | 1        |
| openai/gsm8k test split            | 409 KB | 409 KB     | 1        |
| fineweb-edu shard                  | 2.0 GB | 2.9 MB     | 2        |

Parsing uses [hyparquet](https://github.com/hyparam/hyparquet). The strips are drawn once to a canvas and hovering only redraws the outline, so files with hundreds of row groups stay smooth. The app is built with Svelte 5 and ships as about 34 KB of gzipped JavaScript.

## Limitations

- Remote files need a server that allows cross-origin range requests. Hugging Face does.
- Very wide files (thousands of columns) render, but their row-group panel gets long.
- Min/max for text columns is whatever the writer stored, which is often truncated or missing for long values.
- Encrypted files aren't supported.

## Development

```sh
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout of the code and the checks to run. The Space builds itself from this source with `npm run build` on every push.

The `sensors.parquet` example is written by `scripts/make-sensors.py` with pyarrow: `write_page_index=True`, a bloom filter on `sensor_id`, and rows sorted by `ts`.
