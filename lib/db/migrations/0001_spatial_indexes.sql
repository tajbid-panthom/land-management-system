-- GiST indexes for spatial query performance (run after schema push)
CREATE INDEX IF NOT EXISTS idx_parcels_boundary ON land_parcels USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_mouzas_boundary ON mouzas USING GIST (boundary);
