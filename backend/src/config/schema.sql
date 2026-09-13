-- Transport Analytics — core schema
-- Run once against a fresh Postgres database.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ── Users & access control ──────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Vendors (Ashoka, Golden, Kalpaka, future ones) ──────────────────────
CREATE TABLE vendors (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT UNIQUE NOT NULL,
    -- 'text' = parsable with pdf-parse + template, 'image' = needs AI vision (Pass 2)
    pdf_type     TEXT NOT NULL DEFAULT 'unknown' CHECK (pdf_type IN ('text', 'image', 'unknown')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Uploaded PDF batches (one row per uploaded file) ────────────────────
CREATE TABLE trip_batches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id          UUID REFERENCES vendors(id),
    original_filename  TEXT NOT NULL,
    stored_path        TEXT NOT NULL,
    -- how this file was (or will be) processed
    extraction_method  TEXT NOT NULL CHECK (extraction_method IN ('text', 'vision', 'manual', 'pending_ai')),
    -- did we trust the extraction enough to auto-save, or does staff need to check it?
    review_status      TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    confidence_score    NUMERIC(4,3), -- 0.000–1.000, null until scored
    vehicle_reg_number TEXT,
    driver_name        TEXT,
    start_location     TEXT,
    end_location       TEXT,
    travel_date        DATE,
    total_booked_seats INTEGER,
    total_seats        INTEGER,
    vacant_seats       INTEGER,
    raw_text           TEXT, -- full extracted text, kept for audit / re-parsing later
    uploaded_by        UUID REFERENCES users(id),
    uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Individual passenger records per trip ───────────────────────────────
CREATE TABLE passengers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_batch_id   UUID NOT NULL REFERENCES trip_batches(id) ON DELETE CASCADE,
    seat_no         TEXT,
    pnr             TEXT,
    name            TEXT,
    age             INTEGER,
    gender          TEXT,
    mobile          TEXT,
    boarding_point  TEXT,
    dropping_point  TEXT,
    -- carried down from the batch so passenger-level queries don't need a join
    -- to know whether this specific record's source is fully trustworthy
    source_reliability TEXT NOT NULL CHECK (source_reliability IN ('high', 'needs_review')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speeds up "who travelled with whom" / frequent co-traveller queries
CREATE INDEX idx_passengers_mobile ON passengers (mobile);
CREATE INDEX idx_passengers_name_dob ON passengers (name, age);
CREATE INDEX idx_trip_batches_date ON trip_batches (travel_date);
CREATE INDEX idx_trip_batches_vendor ON trip_batches (vendor_id);

-- ── Audit log — every search / export / lookup gets recorded ───────────
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      TEXT NOT NULL,      -- e.g. 'search', 'export', 'view_passenger'
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
