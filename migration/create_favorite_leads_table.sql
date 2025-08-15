CREATE TABLE IF NOT EXISTS nano_favorite_leads (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  lead_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, lead_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_favorite_leads_user_id ON nano_favorite_leads (user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_leads_lead_id ON nano_favorite_leads (lead_id);
