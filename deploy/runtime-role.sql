-- Run as migration owner after migrations. Supply login via the managed DB
-- identity mechanism. No passwords belong in this file.
CREATE ROLE pb_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO pb_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO pb_runtime;
REVOKE ALL ON schema_migrations FROM pb_runtime;
REVOKE UPDATE,DELETE ON audit_events FROM pb_runtime;
-- Attach pb_runtime to the separately provisioned application login.
-- Migration owner and runtime login must remain distinct.
