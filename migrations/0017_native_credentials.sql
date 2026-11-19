-- USBRIN ID: pilot-only native email/password identity. Apply to a disposable QA D1 first.
-- Existing Cloudflare Access sessions and users remain intact.
CREATE TABLE IF NOT EXISTS native_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt_hex TEXT NOT NULL CHECK(length(salt_hex)=32),
  hash_hex TEXT NOT NULL CHECK(length(hash_hex)=64),
  iterations INTEGER NOT NULL CHECK(iterations >= 600000),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS native_sessions (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credentials_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_native_sessions_user ON native_sessions(user_id,ended_at);
CREATE INDEX IF NOT EXISTS idx_native_sessions_expiry ON native_sessions(expires_at);

CREATE TABLE IF NOT EXISTS native_login_attempts (
  rate_key TEXT PRIMARY KEY CHECK(length(rate_key)=64),
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_login_window ON native_login_attempts(window_start);
