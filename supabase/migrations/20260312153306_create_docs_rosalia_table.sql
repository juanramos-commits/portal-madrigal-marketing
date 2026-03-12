-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the documents table
CREATE TABLE IF NOT EXISTS documentos_madrigal_marketing_rosalia (
  id BIGINT PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS idx_docs_rosalia_embedding 
  ON documentos_madrigal_marketing_rosalia 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Ensure the RPC function exists
CREATE OR REPLACE FUNCTION match_documents_rosalia(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documentos_madrigal_marketing_rosalia d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
