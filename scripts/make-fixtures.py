# /// script
# dependencies = ["pyarrow>=21"]
# ///
"""Writes the small Parquet files the unit tests read. Run with `uv run scripts/make-fixtures.py`."""

import pyarrow as pa
import pyarrow.parquet as pq

rows = 6
nested = pa.table(
    {
        "id": pa.array(range(rows), pa.int64()),
        "city": pa.array(["Paris", "Oslo", "Lima", "Rome", "Oslo", "Paris"], pa.string()),
        "tags": pa.array([["a", "b"], [], ["c"], None, ["d"], ["e", "f"]], pa.list_(pa.string())),
        "stats/observation.images.head_stereo_left/q50": pa.array(
            [[[[float(i)]]] for i in range(rows)], pa.list_(pa.list_(pa.list_(pa.float64())))
        ),
        "point": pa.array([{"x": i, "y": -i} for i in range(rows)], pa.struct([("x", pa.int32()), ("y", pa.int32())])),
        "points": pa.array(
            [[{"x": i, "y": i}] for i in range(rows)], pa.list_(pa.struct([("x", pa.int32()), ("y", pa.int32())]))
        ),
    }
)
pq.write_table(nested, "tests/fixtures/nested.parquet", row_group_size=3, write_page_index=True)
print(pq.ParquetFile("tests/fixtures/nested.parquet").schema)
