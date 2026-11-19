-- USBRIN ID: custom in-site login using ZITADEL Session API, QA-only until homologation.
-- Identity links are provisioned by an administrator; never auto-link by an unverified email.
CREATE TABLE IF NOT EXISTS zitadel_identity_links (
  zitadel_user_id TEXT PRIMARY KEY NOT NULL CHECK(length(zitadel_user_id) BETWEEN 3 AND 200),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zitadel_app_sessions (
  digest TEXT PRIMARY KEY NOT NULL CHECK(length(digest)=64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zitadel_user_id TEXT NOT NULL REFERENCES zitadel_identity_links(zitadel_user_id) ON DELETE CASCADE,
  zitadel_session_id TEXT NOT NULL CHECK(length(zitadel_session_id) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  checked_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_zitadel_app_sessions_user ON zitadel_app_sessions(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_zitadel_app_sessions_expiry ON zitadel_app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS zitadel_login_attempts (
  rate_key TEXT PRIMARY KEY CHECK(length(rate_key)=64),
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_zitadel_attempts_window ON zitadel_login_attempts(window_start);
