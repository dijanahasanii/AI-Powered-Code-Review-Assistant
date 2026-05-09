-- Run once in Supabase SQL editor (shows why a review failed in the UI)
ALTER TABLE code_reviews ADD COLUMN IF NOT EXISTS error_message TEXT;
