-- Apply only to the isolated USBRIN ID pilot before enabling its session experiment.
CREATE TABLE IF NOT EXISTS portal_session_challenges (
  digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_sub TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_session_challenges_expiry ON portal_session_challenges(expires_at);

CREATE TABLE IF NOT EXISTS portal_sessions (
  digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_sub TEXT NOT NULL,
  challenge_digest TEXT NOT NULL UNIQUE,
  proof_digest TEXT NOT NULL UNIQUE,
  proof_expires_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS portal_sessions_activity ON portal_sessions(last_active_at);
