# /// script
# dependencies = ["pyarrow>=25", "geopandas>=1.2", "geoarrow-pyarrow>=0.3", "shapely>=2.1", "pyproj>=3.8"]
# ///
"""Writes the small Parquet files the unit tests read. Run with `uv run scripts/make-fixtures.py`."""

import geoarrow.pyarrow as ga
import geopandas as gpd
import pyarrow as pa
import pyarrow.parquet as pq
import pyproj
import shapely

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

# GeoParquet: points marching east so each row group of 3 has its own bbox.
shapes = [shapely.Point(i, -i) for i in range(rows - 1)] + [shapely.LineString([(5, -5), (6, -4)])]
frame = gpd.GeoDataFrame({"id": range(rows)}, geometry=shapes)
# 1.0 metadata only, with a projected CRS so `crs` is PROJJSON.
frame.set_crs(3857).to_parquet("tests/fixtures/geo-v1.parquet", schema_version="1.0.0", row_group_size=3)
# 1.1 metadata with a bbox covering column, which gives per row group bounds through plain min/max.
frame.set_crs(4326).to_parquet("tests/fixtures/geo-covering.parquet", write_covering_bbox=True, row_group_size=3)
# 2.0: the native GEOMETRY type plus the `geo` key on top. Needs GeoPandas 1.2.
frame.set_crs(4326).to_parquet("tests/fixtures/geo-v2.parquet", schema_version="2.0.0", row_group_size=3)

# Native Parquet GEOMETRY and GEOGRAPHY types with no `geo` key, one column per `crs` form Arrow writes.
# GEOMETRY chunks carry geospatial statistics.
wkb = pa.array([s.wkb for s in shapes])
native = pa.table(
    {
        "id": pa.array(range(rows), pa.int64()),
        "geom": ga.wkb().with_crs("EPSG:3857").wrap_array(wkb),
        "geog": ga.wkb().with_crs("OGC:CRS84").with_edge_type(ga.EdgeType.SPHERICAL).wrap_array(wkb),
        "unknown": ga.wkb().with_crs("srid:0").wrap_array(wkb),
        "utm": ga.wkb().with_crs(pyproj.CRS("EPSG:32631").to_json()).wrap_array(wkb),
    }
)
pq.write_table(native, "tests/fixtures/geo-native.parquet", row_group_size=3)
for name in ["geo-v1", "geo-covering", "geo-v2", "geo-native"]:
    print(pq.ParquetFile(f"tests/fixtures/{name}.parquet").schema)
