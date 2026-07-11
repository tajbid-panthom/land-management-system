#!/usr/bin/env python3
"""
Main GIS processing orchestrator.

Usage:
  python3 process_mpk.py --input /path/to/file.mpk --output /path/to/processed --job-id <uuid>

Writes progress JSON lines to stderr and final result JSON to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path

from extract import extract_archive
from importer import export_layer, slugify, write_manifest
from metadata import combined_bbox, layer_metadata
from styles import style_for_geometry
from validator import list_layers, read_dataset, validate_and_fix
from projection import to_wgs84


def log_progress(status: str, progress: int, message: str) -> None:
    payload = {"status": status, "progress": progress, "message": message}
    print(json.dumps(payload), file=sys.stderr, flush=True)


def discover_layers(extraction: dict) -> list[dict]:
    tasks: list[dict] = []

    for gdb in extraction.get("geodatabases", []):
        for layer_name in list_layers(gdb):
            tasks.append(
                {
                    "source_path": gdb,
                    "layer_name": layer_name,
                    "gdb_layer": layer_name,
                }
            )

    for dataset in extraction.get("datasets", []):
        path = dataset["path"]
        ext = dataset["type"]
        if ext == "gdb":
            continue
        name = dataset["name"]
        tasks.append({"source_path": path, "layer_name": name, "gdb_layer": None})

    return tasks


def process(input_path: str, output_dir: str) -> dict:
    log_progress("Extracting", 10, f"Extracting archive: {Path(input_path).name}")
    extraction = extract_archive(input_path, str(Path(output_dir) / "extracted"))

    archive_type = extraction.get("archive_type", "unknown")
    dataset_count = len(extraction.get("datasets", []))
    gdb_count = len(extraction.get("geodatabases", []))
    log_progress(
        "Extracting",
        15,
        f"Archive type: {archive_type} — found {dataset_count} dataset(s), {gdb_count} geodatabase(s)",
    )

    log_progress("Reading Layers", 25, "Discovering GIS layers...")
    tasks = discover_layers(extraction)

    if not tasks:
        raise ValueError(
            "No GIS vector layers found. Supported: .shp, .geojson, .gpkg, .gdb inside MPK/ZIP."
        )

    log_progress(
        "Reading Layers",
        28,
        f"Discovered {len(tasks)} layer(s): {', '.join(t['layer_name'] for t in tasks[:8])}"
        + ("..." if len(tasks) > 8 else ""),
    )

    processed_dir = Path(output_dir) / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    exported_layers: list[dict] = []
    total = len(tasks)

    for idx, task in enumerate(tasks):
        pct = 30 + int((idx / max(total, 1)) * 50)
        layer_name = task["layer_name"]
        log_progress(
            "Importing",
            pct,
            f"[{idx + 1}/{total}] Processing layer: {layer_name}...",
        )

        try:
            exported = export_layer(
                task["source_path"],
                layer_name,
                str(processed_dir),
                gdb_layer=task.get("gdb_layer"),
            )

            gdf = read_dataset(exported["geojson_path"])
            gdf, fixed_count = validate_and_fix(gdf)
            gdf = to_wgs84(gdf)
            meta = layer_metadata(gdf, exported["layer_name"])
            style = style_for_geometry(meta["geometry"], idx)

            if fixed_count > 0:
                log_progress(
                    "Importing",
                    pct,
                    f"  Fixed {fixed_count} invalid geometry(ies) in {layer_name}",
                )

            log_progress(
                "Importing",
                pct,
                f"  ✓ {layer_name}: {meta['geometry']}, {meta['features']} features → GeoJSON",
            )

            exported_layers.append(
                {
                    **exported,
                    **meta,
                    "style_json": style,
                    "sort_order": idx,
                }
            )
        except Exception as layer_err:
            log_progress(
                "Importing",
                pct,
                f"  ✗ {layer_name} failed: {layer_err}",
            )
            exported_layers.append(
                {
                    "layer_name": layer_name,
                    "table_name": slugify(layer_name),
                    "error": str(layer_err),
                    "features": 0,
                }
            )

    successful = [layer for layer in exported_layers if not layer.get("error")]
    failed = [layer for layer in exported_layers if layer.get("error")]

    if failed:
        log_progress(
            "Importing",
            82,
            f"{len(failed)} layer(s) failed during Python processing",
        )

    if not successful:
        raise ValueError("All layers failed to import. Check archive contents.")

    log_progress(
        "Creating Index",
        85,
        f"Writing manifest for {len(successful)} layer(s)...",
    )
    manifest_path = write_manifest(
        str(processed_dir),
        successful,
        {
            "bbox": combined_bbox(successful),
            "layer_count": len(successful),
            "extraction": {
                "datasets_found": len(extraction.get("datasets", [])),
                "geodatabases_found": len(extraction.get("geodatabases", [])),
            },
        },
    )

    log_progress("Publishing", 95, "Finalizing...")
    return {
        "status": "Completed",
        "manifest_path": manifest_path,
        "layers": [
            {
                "name": layer["layer_name"],
                "table_name": layer["table_name"],
                "geometry": layer.get("geometry", "Unknown"),
                "features": layer.get("features", 0),
                "bbox": layer.get("bbox"),
                "geojson_path": layer.get("geojson_path"),
                "style_json": layer.get("style_json"),
                "sort_order": layer.get("sort_order", 0),
            }
            for layer in successful
        ],
        "bbox": combined_bbox(successful),
        "errors": [layer for layer in exported_layers if layer.get("error")],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Process GIS map packages")
    parser.add_argument("--input", required=True, help="Path to MPK/ZIP/SHP/GPKG file")
    parser.add_argument("--output", required=True, help="Output working directory")
    parser.add_argument("--job-id", default="", help="Processing job ID")
    args = parser.parse_args()

    try:
        log_progress("Queued", 5, "Starting GIS processing...")
        result = process(args.input, args.output)
        log_progress("Completed", 100, "Processing completed successfully.")
        print(json.dumps(result))
        return 0
    except Exception as exc:
        log_progress("Failed", 100, str(exc))
        print(
            json.dumps(
                {
                    "status": "Failed",
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
