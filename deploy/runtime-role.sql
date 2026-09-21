-- Run as the migration IAM identity after migrations. This is intentionally an
-- explicit allowlist so a future migration does not silently expose a table.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'platinum_bleu' THEN
    RAISE EXCEPTION 'Wrong database; expected platinum_bleu';
  END IF;
  IF current_user <> 'pb-dashboard-migrate@platinum-bleu-drive.iam' THEN
    RAISE EXCEPTION 'runtime-role.sql requires the migration identity';
  END IF;
  IF has_table_privilege('pb-dashboard-runtime@platinum-bleu-drive.iam','audit_events','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('pb-dashboard-worker@platinum-bleu-drive.iam','audit_events','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Unsafe inherited audit write access';
  END IF;
END $$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pb_runtime;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "pb-dashboard-runtime@platinum-bleu-drive.iam";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "pb-dashboard-worker@platinum-bleu-drive.iam";
GRANT SELECT,INSERT,UPDATE,DELETE ON
  tenants,members,login_transactions,sessions,customers,jobs,assignments,
  resources,reservations,leads,invoices,documents,import_batches,connections,
  commands,webhook_inbox,idempotency,connector_oauth,connector_tokens,
  external_snapshots
TO pb_runtime;
GRANT SELECT,INSERT ON audit_events TO pb_runtime;
REVOKE ALL PRIVILEGES ON schema_migrations FROM pb_runtime;
COMMIT;
