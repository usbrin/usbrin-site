-- Native USBRIN ID account onboarding and password recovery. QA migration ONLY.
-- One-time tokens are stored as SHA-256 digests; no plaintext token or password is persisted.
CREATE TABLE IF NOT EXISTS native_password_links (
  token_digest TEXT PRIMARY KEY CHECK(length(token_digest)=64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  consumed_nonce TEXT
);
CREATE INDEX IF NOT EXISTS idx_native_links_user ON native_password_links(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_native_links_expiration ON native_password_links(expires_at);

CREATE TABLE IF NOT EXISTS native_password_request_limits (
  rate_key TEXT PRIMARY KEY CHECK(length(rate_key)=64),
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_password_limit_window ON native_password_request_limits(window_start);
