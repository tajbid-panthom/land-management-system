"""Prepare layer GeoJSON exports for PostGIS import."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd

from projection import to_wgs84
from validator import read_dataset, validate_and_fix


def slugify(name: str) -> str:
    cleaned = "".join(c if c.isalnum() else "_" for c in name.lower())
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.strip("_")[:80] or "layer"


def export_layer(
    source_path: str,
    layer_name: str,
    output_dir: str,
    gdb_layer: str | None = None,
) -> dict:
    gdf = read_dataset(source_path, layer=gdb_layer)
    gdf, fixed_count = validate_and_fix(gdf)
    gdf = to_wgs84(gdf)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    slug = slugify(layer_name)
    geojson_path = out_dir / f"{slug}.geojson"

    gdf.to_file(geojson_path, driver="GeoJSON")

    return {
        "layer_name": layer_name,
        "table_name": slug,
        "geojson_path": str(geojson_path),
        "fixed_geometries": fixed_count,
        "feature_count": int(len(gdf)),
        "geometry_type": _geometry_type(gdf),
        "bbox": gdf.total_bounds.tolist() if not gdf.empty else None,
    }


def _geometry_type(gdf: gpd.GeoDataFrame) -> str:
    if gdf.empty:
        return "Unknown"
    return gdf.geometry.iloc[0].geom_type


def write_manifest(output_dir: str, layers: list[dict], extra: dict | None = None) -> str:
    manifest = {"layers": layers, **(extra or {})}
    path = Path(output_dir) / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return str(path)
