-- Rename columns and change types to support JSON arrays (TEXT)

-- For Appointments
ALTER TABLE appointments 
DROP COLUMN prescription_url,
ADD COLUMN prescription_urls TEXT; -- JSON array of strings

-- For Blog Posts
ALTER TABLE blog_posts 
DROP COLUMN image_url,
ADD COLUMN image_urls TEXT; -- JSON array of strings
