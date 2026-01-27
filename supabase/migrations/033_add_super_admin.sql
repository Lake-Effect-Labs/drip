-- Migration: Add super admin flag to user_profiles
-- Allows specific users to access the admin dashboard

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed samfilipiak@gmail.com as super admin
UPDATE user_profiles SET is_super_admin = TRUE WHERE email = 'samfilipiak@gmail.com';
