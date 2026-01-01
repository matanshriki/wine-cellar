-- Enable uuid-ossp extension for UUID generation
-- This must run before any tables that use uuid_generate_v4()

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

