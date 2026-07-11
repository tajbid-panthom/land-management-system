"""Extract GIS archives (MPK, ZIP, 7z, GDB folders) to a working directory."""

from __future__ import annotations

import os
import shutil
import zipfile
from pathlib import Path

SUPPORTED_VECTOR_EXTENSIONS = {
    ".shp",
    ".geojson",
    ".json",
    ".gpkg",
    ".kml",
    ".gml",
}

ZIP_MAGIC = b"PK"
SEVEN_ZIP_MAGIC = b"7z\xbc\xaf\x27\x1c"


def detect_archive_type(path: Path) -> str:
    with path.open("rb") as handle:
        magic = handle.read(6)
    if magic[:2] == ZIP_MAGIC:
        return "zip"
    if magic == SEVEN_ZIP_MAGIC:
        return "7z"
    return "unknown"


def _extract_zip_to_dir(zip_path: Path, dest: Path) -> None:
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest)


def _extract_7z_to_dir(seven_zip_path: Path, dest: Path) -> None:
    try:
        import py7zr
    except ImportError as exc:
        raise RuntimeError(
            "7-Zip MPK archives require py7zr. Run: pip install -r python/requirements.txt"
        ) from exc

    with py7zr.SevenZipFile(seven_zip_path, mode="r") as archive:
        archive.extractall(path=dest)


def _extract_archive_to_dir(archive_path: Path, dest: Path) -> None:
    archive_type = detect_archive_type(archive_path)
    if archive_type == "7z":
        _extract_7z_to_dir(archive_path, dest)
        return
    if archive_type == "zip":
        _extract_zip_to_dir(archive_path, dest)
        return
    raise ValueError(
        f"Unsupported archive format for {archive_path.name}. "
        "Expected ZIP or 7-Zip (ArcGIS .mpk)."
    )


def _extract_nested_archives(dest: Path) -> None:
    patterns = ("*.zip", "*.mpk", "*.7z")
    for pattern in patterns:
        for nested in list(dest.rglob(pattern)):
            if not nested.is_file():
                continue
            nested_dest = nested.parent / f"{nested.stem}_extracted"
            if nested_dest.exists():
                continue
            try:
                _extract_archive_to_dir(nested, nested_dest)
            except (zipfile.BadZipFile, RuntimeError, ValueError):
                continue


def extract_archive(source_path: str, dest_dir: str) -> dict:
    """Extract archive and locate GIS datasets."""
    source = Path(source_path)
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)

    ext = source.suffix.lower()

    if ext in {".mpk", ".zip", ".7z"}:
        _extract_archive_to_dir(source, dest)
        _extract_nested_archives(dest)
    elif ext == ".gdb" and source.is_dir():
        shutil.copytree(source, dest / source.name, dirs_exist_ok=True)
    elif ext in {".shp", ".geojson", ".json", ".gpkg"}:
        shutil.copy2(source, dest / source.name)
    else:
        archive_type = detect_archive_type(source)
        if archive_type in {"zip", "7z"}:
            _extract_archive_to_dir(source, dest)
            _extract_nested_archives(dest)
        else:
            shutil.copy2(source, dest / source.name)

    datasets: list[dict] = []
    gdb_dirs: list[str] = []

    for root, dirs, files in os.walk(dest):
        root_path = Path(root)
        for d in dirs:
            if d.lower().endswith(".gdb"):
                gdb_dirs.append(str(root_path / d))

        for fname in files:
            fpath = root_path / fname
            fext = fpath.suffix.lower()
            if fext in SUPPORTED_VECTOR_EXTENSIONS:
                datasets.append(
                    {
                        "path": str(fpath),
                        "type": fext.lstrip("."),
                        "name": fpath.stem,
                    }
                )

    return {
        "extracted_dir": str(dest),
        "archive_type": detect_archive_type(source)
        if source.is_file()
        else "folder",
        "datasets": datasets,
        "geodatabases": gdb_dirs,
        "mxd_files": _find_by_ext(dest, ".mxd"),
        "lyr_files": _find_by_ext(dest, ".lyr"),
        "tif_files": _find_by_ext(dest, ".tif"),
    }


def _find_by_ext(base: Path, extension: str) -> list[str]:
    results: list[str] = []
    for root, _, files in os.walk(base):
        for fname in files:
            if fname.lower().endswith(extension):
                results.append(str(Path(root) / fname))
    return results
