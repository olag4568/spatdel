-- Store the actual map pin for each property listing.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_map_coordinates_pair_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_map_coordinates_pair_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );

CREATE INDEX IF NOT EXISTS properties_map_coordinates_idx
  ON public.properties (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
