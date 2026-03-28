ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

UPDATE users SET email = CONCAT(username, '@example.com')
WHERE email IS NULL;

ALTER TABLE users
ALTER COLUMN email SET NOT NULL;
