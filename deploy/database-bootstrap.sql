-- One-time, idempotent database bootstrap. Run with the Cloud SQL
-- administrative database identity before migrations. IAM users must already
-- exist at the Cloud SQL layer; this script never creates passwords or logins.
BEGIN;
DO $$
DECLARE
  valid_iam_users integer;
BEGIN
  IF current_database() <> 'platinum_bleu' THEN
    RAISE EXCEPTION 'Wrong database; expected platinum_bleu';
  END IF;

  SELECT count(*) INTO valid_iam_users
  FROM pg_roles
  WHERE rolname IN (
    'pb-dashboard-runtime@platinum-bleu-drive.iam',
    'pb-dashboard-worker@platinum-bleu-drive.iam',
    'pb-dashboard-migrate@platinum-bleu-drive.iam'
  )
    AND rolcanlogin AND rolinherit
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls;
  IF valid_iam_users <> 3 THEN
    RAISE EXCEPTION 'Unsafe or missing preexisting IAM login role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pb_runtime') THEN
    CREATE ROLE pb_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'pb_runtime'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole
           OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Unsafe pb_runtime role flags';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles member_role ON member_role.oid = membership.member
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    WHERE member_role.rolname IN (
      'pb-dashboard-runtime@platinum-bleu-drive.iam',
      'pb-dashboard-worker@platinum-bleu-drive.iam'
    )
      AND (granted_role.rolname <> 'pb_runtime' OR membership.admin_option)
  ) OR EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE member_role.rolname = 'pb_runtime'
  ) THEN
    RAISE EXCEPTION 'Unsafe workload role membership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class object
    JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
    JOIN pg_roles owner_role ON owner_role.oid = object.relowner
    WHERE namespace.nspname = 'public'
      AND owner_role.rolname IN (
        'pb_runtime',
        'pb-dashboard-runtime@platinum-bleu-drive.iam',
        'pb-dashboard-worker@platinum-bleu-drive.iam'
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_namespace namespace
    JOIN pg_roles owner_role ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname = 'public'
      AND owner_role.rolname IN (
        'pb_runtime',
        'pb-dashboard-runtime@platinum-bleu-drive.iam',
        'pb-dashboard-worker@platinum-bleu-drive.iam'
      )
  ) THEN
    RAISE EXCEPTION 'Unsafe workload object ownership';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM pb_runtime;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM "pb-dashboard-runtime@platinum-bleu-drive.iam";
REVOKE ALL PRIVILEGES ON SCHEMA public FROM "pb-dashboard-worker@platinum-bleu-drive.iam";
REVOKE ALL PRIVILEGES ON SCHEMA public FROM "pb-dashboard-migrate@platinum-bleu-drive.iam";
REVOKE TEMPORARY ON DATABASE platinum_bleu FROM PUBLIC;
REVOKE ALL PRIVILEGES ON DATABASE platinum_bleu FROM pb_runtime;
REVOKE ALL PRIVILEGES ON DATABASE platinum_bleu FROM "pb-dashboard-runtime@platinum-bleu-drive.iam";
REVOKE ALL PRIVILEGES ON DATABASE platinum_bleu FROM "pb-dashboard-worker@platinum-bleu-drive.iam";
REVOKE ALL PRIVILEGES ON DATABASE platinum_bleu FROM "pb-dashboard-migrate@platinum-bleu-drive.iam";
GRANT CONNECT ON DATABASE platinum_bleu TO "pb-dashboard-runtime@platinum-bleu-drive.iam";
GRANT CONNECT ON DATABASE platinum_bleu TO "pb-dashboard-worker@platinum-bleu-drive.iam";
GRANT CONNECT ON DATABASE platinum_bleu TO "pb-dashboard-migrate@platinum-bleu-drive.iam";
GRANT USAGE ON SCHEMA public TO pb_runtime;
GRANT USAGE,CREATE ON SCHEMA public TO "pb-dashboard-migrate@platinum-bleu-drive.iam";
GRANT pb_runtime TO "pb-dashboard-runtime@platinum-bleu-drive.iam";
GRANT pb_runtime TO "pb-dashboard-worker@platinum-bleu-drive.iam";
COMMIT;
