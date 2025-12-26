-- Enable Row Level Security on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
-- Users can view workspaces they're members of
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can create workspaces
CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Owners can update their workspaces
CREATE POLICY "Owners can update workspaces"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    )
  );

-- Owners can delete their workspaces
CREATE POLICY "Owners can delete workspaces"
  ON workspaces FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    )
  );

-- Workspace Members policies
-- Users can view members of workspaces they belong to
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- Users can insert themselves as workspace members (via invite acceptance)
CREATE POLICY "Users can join workspaces"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Owners can delete workspace members
CREATE POLICY "Owners can remove workspace members"
  ON workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- Babies policies
-- Users can view babies in their workspaces
CREATE POLICY "Users can view babies in their workspaces"
  ON babies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = babies.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can create babies in their workspaces
CREATE POLICY "Users can create babies in their workspaces"
  ON babies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = babies.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can update babies in their workspaces
CREATE POLICY "Users can update babies in their workspaces"
  ON babies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = babies.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Owners can delete babies in their workspaces
CREATE POLICY "Owners can delete babies"
  ON babies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = babies.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    )
  );

-- Events policies
-- Users can view events in their workspaces
CREATE POLICY "Users can view events in their workspaces"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can create events in their workspaces
CREATE POLICY "Users can create events in their workspaces"
  ON events FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can update their own events
CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can delete their own events
CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Invites policies
-- Users can view invites for their workspaces
CREATE POLICY "Users can view invites in their workspaces"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invites.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can also view invites sent to their email
CREATE POLICY "Users can view invites sent to them"
  ON invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Owners and members can create invites
CREATE POLICY "Members can create invites in their workspaces"
  ON invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invites.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can update invites (for accepting)
CREATE POLICY "Users can accept invites sent to them"
  ON invites FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Owners can delete invites
CREATE POLICY "Owners can delete invites"
  ON invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invites.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    )
  );

