"""Auto-detect MapLibre-compatible styles per geometry type."""

from __future__ import annotations

PALETTE = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#ca8a04",
    "#9333ea",
    "#0891b2",
    "#ea580c",
    "#4f46e5",
]


def style_for_geometry(geometry_type: str, index: int = 0) -> dict:
    color = PALETTE[index % len(PALETTE)]
    geom = geometry_type.lower()

    if "polygon" in geom or geom == "multipolygon":
        return {
            "type": "fill",
            "paint": {
                "fill-color": color,
                "fill-opacity": 0.35,
                "fill-outline-color": color,
            },
        }

    if "line" in geom or geom == "multilinestring":
        return {
            "type": "line",
            "paint": {
                "line-color": color,
                "line-width": 2,
                "line-opacity": 0.9,
            },
        }

    return {
        "type": "circle",
        "paint": {
            "circle-color": color,
            "circle-radius": 5,
            "circle-opacity": 0.85,
        },
    }
