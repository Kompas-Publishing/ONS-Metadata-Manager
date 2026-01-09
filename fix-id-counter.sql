
SELECT key, value FROM settings WHERE key = 'next_id';

-- Delete the old counter
DELETE FROM settings WHERE key = 'next_id';


-- Or if you want to manually set it, find the highest ID:
-- (Uncomment and run this if you want to see the calculation)

/*
WITH parsed_ids AS (
  SELECT
    id,
    CAST(SPLIT_PART(id, '-', 1) AS INTEGER) * 1000000 +
    CAST(SPLIT_PART(id, '-', 2) AS INTEGER) * 1000 +
    CAST(SPLIT_PART(id, '-', 3) AS INTEGER) AS numeric_id
  FROM metadata_files
)
SELECT
  MAX(numeric_id) + 1 AS next_id_should_be,
  TO_CHAR(MAX(numeric_id) + 1, 'FM000') || '-' ||
  TO_CHAR(((MAX(numeric_id) + 1) / 1000) % 1000, 'FM000') || '-' ||
  TO_CHAR(((MAX(numeric_id) + 1) / 1000000) % 1000, 'FM000') AS formatted
FROM parsed_ids;
*/

-- Manual insert (only if you want to pre-set it):
-- Replace XXXXX with the numeric_id from the query above
-- INSERT INTO settings (key, value, updated_at)
-- VALUES ('next_id', 'XXXXX', NOW());
