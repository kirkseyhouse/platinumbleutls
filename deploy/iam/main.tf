terraform {
  required_version = ">= 1.9.0, < 2.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.50.0"
    }
  }
}

provider "google" {
  project = "platinum-bleu-drive"
  region  = "us-central1"
}

locals {
  project = "platinum-bleu-drive"
  region  = "us-central1"
  accounts = toset([
    "pb-dashboard-runtime", "pb-dashboard-worker", "pb-dashboard-migrate",
    "pb-dashboard-builder", "pb-dashboard-deployer"
  ])
  sql_accounts = toset(["pb-dashboard-runtime", "pb-dashboard-worker", "pb-dashboard-migrate"])
}

variable "human_approver" {
  type    = string
  default = "user:catherine@platinumbleutls.com"
  validation {
    condition     = var.human_approver == "user:catherine@platinumbleutls.com"
    error_message = "The reviewed inline promotion program requires this named human approver."
  }
}

variable "repository_connection_name" {
  type        = string
  description = "Existing approved Cloud Build v2 connection name in us-central1, not a URL."
  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9_-]+$", var.repository_connection_name))
    error_message = "Supply the approved existing repository connection name."
  }
}

variable "secret_consumers" {
  description = "Explicit existing secret IDs to workload names. Empty by default. No project-wide secret grants."
  type        = map(set(string))
  default     = {}
  validation {
    condition = alltrue(flatten([
      for secret, consumers in var.secret_consumers : [
        for consumer in consumers : startswith(secret, "pb-") && contains(["pb-dashboard-runtime", "pb-dashboard-worker"], consumer)
      ]
    ]))
    error_message = "Only pb- secrets and explicitly approved runtime/worker consumers are allowed."
  }
}

resource "google_service_account" "workload" {
  for_each     = local.accounts
  project      = local.project
  account_id   = each.key
  display_name = "Platinum Bleu ${each.key}"
}

# IAM login identity and PostgreSQL privileges are separate. The SQL instance
# must already have cloudsql.iam_authentication=on; no password is generated.
resource "google_sql_user" "workload" {
  for_each = local.sql_accounts
  project  = local.project
  instance = "pb-prod-sql"
  name     = trimsuffix(google_service_account.workload[each.key].email, ".gserviceaccount.com")
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"

  lifecycle {
    prevent_destroy = true
  }
}

# Additive member resources preserve unrelated existing IAM members.
resource "google_project_iam_member" "sql_client" {
  for_each = local.sql_accounts
  project  = local.project
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${google_service_account.workload[each.key].email}"
  condition {
    title      = "dashboard-primary-only"
    expression = "resource.name == 'projects/platinum-bleu-drive/instances/pb-prod-sql' && resource.type == 'sqladmin.googleapis.com/Instance'"
  }
}

resource "google_project_iam_member" "sql_login" {
  for_each = local.sql_accounts
  project  = local.project
  role     = "roles/cloudsql.instanceUser"
  member   = "serviceAccount:${google_service_account.workload[each.key].email}"
  condition {
    title      = "dashboard-primary-only"
    expression = "resource.name == 'projects/platinum-bleu-drive/instances/pb-prod-sql' && resource.type == 'sqladmin.googleapis.com/Instance'"
  }
}

resource "google_artifact_registry_repository_iam_member" "builder" {
  project    = local.project
  location   = local.region
  repository = "pb-dashboard"
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.workload["pb-dashboard-builder"].email}"
}

resource "google_artifact_registry_repository_iam_member" "promoter" {
  project    = local.project
  location   = local.region
  repository = "pb-dashboard"
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.workload["pb-dashboard-deployer"].email}"
}

resource "google_storage_bucket_iam_member" "build_logs" {
  for_each = {
    pb-dashboard-builder  = "platinum-bleu-drive-pb-build-logs"
    pb-dashboard-deployer = "platinum-bleu-drive-pb-promote-logs"
  }
  bucket = each.value
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.workload[each.key].email}"
}

resource "google_project_iam_member" "scan_read" {
  for_each = toset(["pb-dashboard-builder", "pb-dashboard-deployer"])
  project  = local.project
  role     = "roles/containeranalysis.occurrences.viewer"
  member   = "serviceAccount:${google_service_account.workload[each.key].email}"
}

resource "google_project_iam_custom_role" "build_get" {
  project     = local.project
  role_id     = "pbDashboardBuildEvidenceReader"
  title       = "Dashboard build evidence reader"
  permissions = ["cloudbuild.builds.get"]
}

resource "google_project_iam_member" "build_evidence" {
  project = local.project
  role    = google_project_iam_custom_role.build_get.name
  member  = "serviceAccount:${google_service_account.workload["pb-dashboard-deployer"].email}"
}

resource "google_project_iam_custom_role" "service_update" {
  project     = local.project
  role_id     = "pbDashboardRevisionUpdater"
  title       = "Dashboard existing service revision updater"
  permissions = ["run.services.get", "run.services.update"]
}

resource "google_cloud_run_v2_service_iam_member" "update_service" {
  project  = local.project
  location = local.region
  name     = "pb-dashboard"
  role     = google_project_iam_custom_role.service_update.name
  member   = "serviceAccount:${google_service_account.workload["pb-dashboard-deployer"].email}"
}

resource "google_service_account_iam_member" "attach_workload" {
  for_each           = toset(["pb-dashboard-runtime", "pb-dashboard-worker"])
  service_account_id = google_service_account.workload[each.key].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.workload["pb-dashboard-deployer"].email}"
}

resource "google_cloudbuildv2_connection_iam_member" "read_source" {
  project  = local.project
  location = local.region
  name     = var.repository_connection_name
  role     = "roles/cloudbuild.readTokenAccessor"
  member   = "serviceAccount:${google_service_account.workload["pb-dashboard-builder"].email}"
}

resource "google_project_iam_member" "human_approval" {
  project = local.project
  role    = "roles/cloudbuild.builds.approver"
  member  = var.human_approver
}

locals {
  secret_grants = merge({}, [for secret, consumers in var.secret_consumers : {
    for consumer in consumers : "${secret}/${consumer}" => { secret = secret, consumer = consumer }
  }]...)
}

resource "google_secret_manager_secret_iam_member" "workload_secret" {
  for_each  = local.secret_grants
  project   = local.project
  secret_id = each.value.secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.workload[each.value.consumer].email}"
}

output "service_accounts" {
  value = { for name, account in google_service_account.workload : name => account.email }
}
