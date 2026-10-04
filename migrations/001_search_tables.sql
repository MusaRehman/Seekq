-- Create BM25 schema when missing or when legacy columns are still present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'body'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'index_stats' AND column_name = 'doc_count'
  ) THEN
    RETURN;
  END IF;

  DROP TABLE IF EXISTS postings CASCADE;
  DROP TABLE IF EXISTS documents CASCADE;
  DROP TABLE IF EXISTS index_stats CASCADE;

  CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    length INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'indexed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ
  );

  CREATE INDEX documents_status_idx ON documents (status);

  CREATE TABLE postings (
    term TEXT NOT NULL,
    doc_id BIGINT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    tf INT NOT NULL,
    positions INT[] NOT NULL,
    PRIMARY KEY (term, doc_id)
  );

  CREATE INDEX postings_term_idx ON postings (term);

  CREATE TABLE index_stats (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    doc_count INT NOT NULL DEFAULT 0,
    total_length BIGINT NOT NULL DEFAULT 0
  );

  INSERT INTO index_stats (id, doc_count, total_length) VALUES (1, 0, 0);
END $$;
