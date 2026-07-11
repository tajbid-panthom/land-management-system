"""Validate and repair GIS geometries."""

from __future__ import annotations

import geopandas as gpd
from shapely.geometry import mapping
from shapely.validation import make_valid


def _layer_names_from_gdb(path: str) -> list[str]:
    layers = gpd.list_layers(path)
    if hasattr(layers, "columns") and "name" in getattr(layers, "columns", []):
        if layers.empty:
            return []
        return layers["name"].astype(str).tolist()
    if isinstance(layers, list):
        return [
            layer["name"] if isinstance(layer, dict) else str(layer)
            for layer in layers
        ]
    return []


def read_dataset(path: str, layer: str | None = None) -> gpd.GeoDataFrame:
    if path.lower().endswith(".gdb"):
        if layer:
            return gpd.read_file(path, layer=layer)
        names = _layer_names_from_gdb(path)
        if not names:
            raise ValueError(f"No layers found in geodatabase: {path}")
        return gpd.read_file(path, layer=names[0])
    return gpd.read_file(path)


def list_layers(path: str) -> list[str]:
    if path.lower().endswith(".gdb"):
        return _layer_names_from_gdb(path)
    return [path.split("/")[-1].rsplit(".", 1)[0]]


def validate_and_fix(gdf: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, int]:
    """Return cleaned GeoDataFrame and count of fixed geometries."""
    if gdf.empty:
        return gdf, 0

    gdf = gdf[gdf.geometry.notna()].copy()
    fixed = 0

    def _fix(geom):
        nonlocal fixed
        if geom is None or geom.is_empty:
            return geom
        if not geom.is_valid:
            fixed += 1
            return make_valid(geom)
        return geom

    gdf["geometry"] = gdf.geometry.apply(_fix)
    gdf = gdf[~gdf.geometry.is_empty]
    return gdf, fixed


def geometry_type_name(gdf: gpd.GeoDataFrame) -> str:
    if gdf.empty:
        return "Unknown"
    geom = gdf.geometry.iloc[0]
    return mapping(geom)["type"] if geom is not None else "Unknown"
