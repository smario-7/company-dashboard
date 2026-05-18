-- Uruchom w Supabase → SQL Editor (Fix 1 z plan-security-improvements.md)

CREATE OR REPLACE FUNCTION guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = OLD.role THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change user roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_role_change_trigger ON user_profiles;

CREATE TRIGGER guard_role_change_trigger
  BEFORE UPDATE OF role
  ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_role_change();
