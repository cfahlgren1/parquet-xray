# /// script
# dependencies = ["pyarrow>=21", "numpy"]
# ///
"""Writes public/sensors.parquet, the bundled example. Run with `uv run scripts/make-sensors.py`."""

import pyarrow as pa, pyarrow.parquet as pq, numpy as np
rng = np.random.default_rng(7)
n = 400_000
ts = np.datetime64("2024-01-01T00:00:00") + np.arange(n).astype("timedelta64[m]")
sensors = np.array([f"sensor-{i:03d}" for i in range(200)])
cities = np.array(["Paris","Berlin","Tokyo","NYC","Lagos","Lima","Oslo","Seoul","Cairo","Austin","Delhi","Rome"])
temp = np.round(15 + np.cumsum(rng.normal(0, 0.05, n)) + 8*np.sin(np.arange(n)/1440*2*np.pi), 2).astype("float32")
t = pa.table({
  "event_id": pa.array(np.arange(1_000_000, 1_000_000+n), pa.int64()),
  "ts": pa.array(ts.astype("datetime64[ms]")),
  "sensor_id": pa.array(sensors[rng.integers(0,200,n)]),
  "city": pa.array(cities[rng.integers(0,len(cities),n)]),
  "temperature": pa.array(temp),
})
pq.write_table(t, "public/sensors.parquet", row_group_size=50_000, max_rows_per_page=10_000, compression="zstd",
  write_page_index=True, use_content_defined_chunking=True,
  bloom_filter_options={"sensor_id": {"ndv": 200, "fpp": 0.01}},
  sorting_columns=[pq.SortingColumn(1)])
m = pq.ParquetFile("public/sensors.parquet").metadata
print(m.num_row_groups, m.serialized_size, [m.row_group(0).column(i).is_stats_set for i in range(5)])
