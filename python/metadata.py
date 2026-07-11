"""Collect layer metadata (name, geometry type, feature count, bbox)."""

from __future__ import annotations

import geopandas as gpd


def layer_metadata(gdf: gpd.GeoDataFrame, name: str) -> dict:
    from validator import geometry_type_name

    if gdf.empty:
        return {
            "name": name,
            "geometry": "Unknown",
            "features": 0,
            "bbox": None,
        }

    bounds = gdf.total_bounds.tolist()
    return {
        "name": name,
        "geometry": geometry_type_name(gdf),
        "features": int(len(gdf)),
        "bbox": [bounds[0], bounds[1], bounds[2], bounds[3]],
    }


def combined_bbox(layers: list[dict]) -> list[float] | None:
    bboxes = [layer["bbox"] for layer in layers if layer.get("bbox")]
    if not bboxes:
        return None
    minx = min(b[0] for b in bboxes)
    miny = min(b[1] for b in bboxes)
    maxx = max(b[2] for b in bboxes)
    maxy = max(b[3] for b in bboxes)
    return [minx, miny, maxx, maxy]
