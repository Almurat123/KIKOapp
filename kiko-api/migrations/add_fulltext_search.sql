-- Add full-text search capability to trending_casts table
-- This enables keyword search on Farcaster casts

-- Add tsvector column for full-text search
ALTER TABLE trending_casts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_trending_casts_search ON trending_casts USING GIN(search_vector);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_cast_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.text, '') || ' ' || 
    COALESCE(NEW.author_username, '') || ' ' ||
    COALESCE(NEW.author_display_name, '')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search vector on insert/update
DROP TRIGGER IF EXISTS trig_update_cast_search_vector ON trending_casts;
CREATE TRIGGER trig_update_cast_search_vector
BEFORE INSERT OR UPDATE ON trending_casts
FOR EACH ROW EXECUTE FUNCTION update_cast_search_vector();

-- Update existing rows to populate search_vector
UPDATE trending_casts SET search_vector = to_tsvector('english', 
  COALESCE(text, '') || ' ' || 
  COALESCE(author_username, '') || ' ' ||
  COALESCE(author_display_name, '')
);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Full-text search migration completed. Rows updated: %', (SELECT COUNT(*) FROM trending_casts WHERE search_vector IS NOT NULL);
END $$;
