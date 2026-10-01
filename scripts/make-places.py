# /// script
# dependencies = ["pyarrow>=25", "geopandas>=1.2", "shapely>=2.1", "numpy"]
# ///
"""Writes public/places.parquet, the bundled GeoParquet example. Run with `uv run scripts/make-places.py`."""

import geopandas as gpd, numpy as np, pyarrow.parquet as pq, shapely
rng = np.random.default_rng(7)
# One row group per city, west to east, so every row group has its own small bbox.
cities = {
  "Los Angeles": (-118.24, 34.05), "Mexico City": (-99.13, 19.43), "New York": (-74.01, 40.71),
  "São Paulo": (-46.63, -23.55), "London": (-0.13, 51.51), "Paris": (2.35, 48.86), "Lagos": (3.38, 6.52),
  "Cape Town": (18.42, -33.92), "Cairo": (31.24, 30.04), "Moscow": (37.62, 55.76), "Delhi": (77.21, 28.61),
  "Singapore": (103.82, 1.35), "Seoul": (126.98, 37.57), "Tokyo": (139.69, 35.69), "Sydney": (151.21, -33.87),
}
per_city = 4096
names = np.repeat(list(cities), per_city)
lon = np.concatenate([x + rng.normal(0, 0.2, per_city) for x, _ in cities.values()])
lat = np.concatenate([y + rng.normal(0, 0.15, per_city) for _, y in cities.values()])
frame = gpd.GeoDataFrame({"id": np.arange(len(names)), "city": names}, geometry=shapely.points(lon, lat), crs=4326)
# GeoParquet 2.0: the native GEOMETRY type, whose statistics carry a bbox per row group.
frame.to_parquet("public/places.parquet", schema_version="2.0.0", row_group_size=per_city, compression="zstd")
m = pq.ParquetFile("public/places.parquet").metadata
print(m.num_row_groups, m.serialized_size, m.row_group(0).column(2).geo_statistics)
