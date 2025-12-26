-- This is an example seed file for development/testing
-- DO NOT run this in production

-- Note: This assumes you have a test user with a known UUID
-- In practice, you'll create workspaces through the app after signing in

-- Example: Insert a test workspace (replace the UUID with your test user's ID)
-- INSERT INTO workspaces (name, created_by)
-- VALUES ('Test Family', 'your-user-uuid-here');

-- Example: Add the user as an owner
-- INSERT INTO workspace_members (workspace_id, user_id, role)
-- VALUES ('workspace-uuid', 'your-user-uuid-here', 'owner');

-- Example: Add a baby
-- INSERT INTO babies (workspace_id, name, date_of_birth)
-- VALUES ('workspace-uuid', 'Baby Name', '2024-01-01');

