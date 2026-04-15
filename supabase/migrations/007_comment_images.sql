-- Add image support to visit comments

-- 1. Add image_url column
ALTER TABLE public.visit_comments
  ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Allow image-only comments (content becomes optional)
ALTER TABLE public.visit_comments
  ALTER COLUMN content DROP NOT NULL;

-- 3. Require at least one of content or image_url
ALTER TABLE public.visit_comments
  DROP CONSTRAINT IF EXISTS visit_comments_content_or_image_check;
ALTER TABLE public.visit_comments
  ADD CONSTRAINT visit_comments_content_or_image_check
  CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0)
    OR image_url IS NOT NULL
  );

-- 4. Create public storage bucket for comment images
INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage policies — authenticated users can upload, everyone can read
DROP POLICY IF EXISTS "comment_images_read" ON storage.objects;
CREATE POLICY "comment_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "comment_images_insert" ON storage.objects;
CREATE POLICY "comment_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comment-images');
