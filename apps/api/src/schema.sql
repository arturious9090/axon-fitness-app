CREATE TABLE IF NOT EXISTS fitness_records (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('plan','workout','settings')),
  entity_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  sequence bigserial NOT NULL,
  data jsonb,
  PRIMARY KEY (user_id, kind, entity_id)
);
CREATE INDEX IF NOT EXISTS fitness_records_cursor ON fitness_records(user_id, sequence);
CREATE TABLE IF NOT EXISTS sync_receipts (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  operation_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS email_jobs (
  id uuid PRIMARY KEY,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  payload text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','test')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  provider_id text
);
CREATE INDEX IF NOT EXISTS email_jobs_pending ON email_jobs(status, available_at);
