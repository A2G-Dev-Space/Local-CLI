-- Add sort_order column to models table
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Initialize sort_order based on existing displayName order
WITH ordered_models AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "displayName" ASC) - 1 as new_order
  FROM "models"
)
UPDATE "models" m
SET "sort_order" = om.new_order
FROM ordered_models om
WHERE m.id = om.id;
