CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('preventivo','correctivo')),
  description TEXT,
  planned_date DATE,
  deadline_date DATE,
  source TEXT DEFAULT 'manual',
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'abierto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('preventivo','correctivo')),
  summary TEXT,
  findings TEXT,
  actions_taken TEXT,
  asset_status_observations TEXT,
  area_responsible_required BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES maintenance_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  signature_path TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_invima_registration TEXT,
  signature_sha256 VARCHAR(64),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reader_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  area_id UUID,
  location_id UUID
);
