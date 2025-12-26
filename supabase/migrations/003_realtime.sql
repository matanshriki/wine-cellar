-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Enable realtime for babies table
ALTER PUBLICATION supabase_realtime ADD TABLE babies;

-- Enable realtime for workspace_members table
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;

-- Enable realtime for invites table
ALTER PUBLICATION supabase_realtime ADD TABLE invites;

