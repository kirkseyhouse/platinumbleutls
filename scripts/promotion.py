"""Reviewed promotion program, embedded into the administrative inline trigger.

No repository code is loaded by the promotion build. Change trust constants only
after provisioning approval and regenerate the inline YAML; record its SHA-256.
"""
import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request

PROJECT = 'platinum-bleu-drive'
REGION = 'us-central1'
IMAGE = REGION + '-docker.pkg.dev/' + PROJECT + '/pb-dashboard/dashboard'
BUILDER = 'projects/' + PROJECT + '/serviceAccounts/pb-dashboard-builder@' + PROJECT + '.iam.gserviceaccount.com'
DEPLOYER = 'projects/' + PROJECT + '/serviceAccounts/pb-dashboard-deployer@' + PROJECT + '.iam.gserviceaccount.com'
# These are administrative trust anchors, deliberately NOT build substitutions.
BUILD_TRIGGER = 'REQUIRED_BUILDER_TRIGGER_UUID'
PROMOTE_TRIGGER = 'REQUIRED_PROMOTER_TRIGGER_UUID'
APPROVER = 'catherine@platinumbleutls.com'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def gcloud(*args):
    result = subprocess.run(['gcloud', *args, '--project=' + PROJECT, '--quiet', '--format=json'],
                            capture_output=True, text=True, timeout=180, check=True)
    return json.loads(result.stdout)

def validate_build(build, sha, digest, trigger):
    require(re.fullmatch(r'[0-9a-f]{40}', sha), 'Exact commit SHA required')
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', digest), 'Exact image digest required')
    require(build.get('projectId') == PROJECT, 'Wrong builder project')
    require(build.get('status') == 'SUCCESS', 'Builder must have completed successfully')
    require(build.get('serviceAccount') == BUILDER, 'Wrong builder identity')
    require(build.get('buildTriggerId') == trigger, 'Wrong builder trigger')
    require(build.get('substitutions', {}).get('COMMIT_SHA') == sha, 'Build commit mismatch')
    source = build.get('sourceProvenance', {})
    resolved = (source.get('resolvedRepoSource', {}).get('commitSha')
                or source.get('resolvedConnectedRepository', {}).get('revision')
                or source.get('resolvedGitSource', {}).get('revision'))
    require(resolved == sha, 'Resolved source provenance mismatch or absent')
    images = build.get('results', {}).get('images', [])
    require(any(i.get('name') == IMAGE + ':' + sha and i.get('digest') == digest for i in images),
            'Digest was not published by the recorded build')

def validate_approval(build, trigger, approver):
    require(build.get('buildTriggerId') == trigger, 'Wrong promotion trigger')
    require(build.get('serviceAccount') == DEPLOYER, 'Wrong promotion identity')
    approval = build.get('approval', {})
    require(approval.get('state') == 'APPROVED', 'Promotion is not approved')
    result = approval.get('result', {})
    require(result.get('decision') == 'APPROVED' and result.get('approverAccount') == approver,
            'Named owner approval is required')

def validate_service(service):
    require(service.get('metadata', {}).get('name') == 'pb-dashboard', 'Service identity mismatch')
    require(service.get('metadata', {}).get('annotations', {}).get('run.googleapis.com/ingress') ==
            'internal-and-cloud-load-balancing', 'Ingress mismatch')
    template = service.get('spec', {}).get('template', {})
    annotations = template.get('metadata', {}).get('annotations', {})
    try:
        network = json.loads(annotations.get('run.googleapis.com/network-interfaces', ''))
    except (TypeError, json.JSONDecodeError):
        network = None
    require(network == [{'network': 'pb-prod-vpc', 'subnetwork': 'pb-prod-us-central1',
                         'tags': 'pb-dashboard'}], 'Private network mismatch')
    require(annotations.get('run.googleapis.com/vpc-access-egress') == 'private-ranges-only',
            'Private-ranges-only egress required')
    try:
        max_scale = int(annotations.get('autoscaling.knative.dev/maxScale', ''))
    except (TypeError, ValueError):
        max_scale = 0
    require(0 < max_scale <= 5, 'Maximum instance count exceeds the reviewed connection budget')
    spec = template.get('spec', {})
    require(spec.get('serviceAccountName') ==
            'pb-dashboard-runtime@' + PROJECT + '.iam.gserviceaccount.com', 'Runtime identity mismatch')
    require(0 < int(spec.get('containerConcurrency', 0)) <= 8, 'Container concurrency exceeds the reviewed limit')
    containers = spec.get('containers', [])
    require(len(containers) == 1, 'Exactly one dashboard container is required')
    entries = containers[0].get('env', [])
    names = [entry.get('name') for entry in entries]
    require(len(names) == len(set(names)), 'Duplicate environment variables are prohibited')
    prohibited = {'DATABASE_URL', 'MIGRATION_DATABASE_URL', 'PGPASSWORD', 'PGHOST', 'PGHOSTADDR',
                  'PGPORT', 'PGUSER', 'PGDATABASE', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSFILE', 'PGSSLMODE'}
    require(not prohibited.intersection(names), 'Password-style database configuration is prohibited')
    env = {entry.get('name'): entry.get('value') for entry in entries}
    require(env.get('NODE_ENV') == 'production', 'Production environment required')
    require(env.get('OPERATIONAL_MODE') == 'hcp_coexistence', 'Coexistence required')
    require(env.get('APP_ORIGIN') == 'https://ops.platinumbleutls.com', 'Application origin mismatch')
    require(env.get('INSTANCE_CONNECTION_NAME') == PROJECT + ':us-central1:pb-prod-sql',
            'Cloud SQL instance mismatch')
    require(env.get('DB_NAME') == 'platinum_bleu', 'Database name mismatch')
    require(env.get('DB_IAM_USER') == 'pb-dashboard-runtime@' + PROJECT + '.iam',
            'Database IAM identity mismatch')
    by_name = {entry.get('name'): entry for entry in entries}
    for variable, secret in [('GOOGLE_CLIENT_ID', 'pb-google-client-id'),
                             ('GOOGLE_CLIENT_SECRET', 'pb-google-client-secret')]:
        entry = by_name.get(variable, {})
        reference = entry.get('valueFrom', {}).get('secretKeyRef', {})
        require('value' not in entry and reference.get('name') == secret and
                re.fullmatch(r'[1-9][0-9]*', str(reference.get('key', ''))),
                variable + ' must use its approved numbered secret version')

def scan_clean(occurrences):
    discoveries = [o.get('discovery', {}) for o in occurrences if o.get('kind') == 'DISCOVERY']
    for discovery in discoveries:
        require(discovery.get('analysisStatus') not in ['FINISHED_FAILED', 'FINISHED_UNSUPPORTED'], 'Image scan failed or unsupported')
    for occurrence in occurrences:
        if occurrence.get('kind') == 'VULNERABILITY':
            vulnerability = occurrence.get('vulnerability', {})
            severity = vulnerability.get('effectiveSeverity') or vulnerability.get('severity')
            require(severity in ['MINIMAL', 'LOW', 'MEDIUM'], 'High, critical, or unknown image vulnerability')
    return bool(discoveries) and all(d.get('analysisStatus') == 'FINISHED_SUCCESS' for d in discoveries)

def occurrences(digest):
    token = subprocess.run(['gcloud', 'auth', 'print-access-token', '--project=' + PROJECT],
                           capture_output=True, text=True, check=True, timeout=60).stdout.strip()
    result, page = [], ''
    while True:
        query = {'filter': 'resourceUrl="https://' + IMAGE + '@' + digest + '"', 'pageSize': '1000'}
        if page: query['pageToken'] = page
        url = 'https://containeranalysis.googleapis.com/v1/projects/' + PROJECT + '/occurrences?' + urllib.parse.urlencode(query)
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.load(response)
        result.extend(body.get('occurrences', []))
        page = body.get('nextPageToken')
        if not page: return result

def wait_scan(digest):
    for attempt in range(60):
        if scan_clean(occurrences(digest)):
            print('Artifact Analysis completed; no high, critical, or unknown findings.')
            return
        time.sleep(10)
    raise ValueError('Image scan did not finish within ten minutes')

def main():
    require(not BUILD_TRIGGER.startswith('REQUIRED_') and not PROMOTE_TRIGGER.startswith('REQUIRED_'),
            'Administrative trigger identities must be provisioned and reviewed first')
    sha, digest, build_id = os.environ['PB_COMMIT'], os.environ['PB_DIGEST'], os.environ['PB_BUILDER_ID']
    require(re.fullmatch(r'[0-9a-f-]{36}', build_id), 'Exact builder build ID required')
    own = gcloud('builds', 'describe', os.environ['PB_PROMOTION_ID'], '--region=' + REGION)
    validate_approval(own, PROMOTE_TRIGGER, APPROVER)
    build = gcloud('builds', 'describe', build_id, '--region=' + REGION)
    validate_build(build, sha, digest, BUILD_TRIGGER)
    wait_scan(digest)
    # Existing service only. Bootstrap configuration, IAM SQL, secrets, networking,
    # provider proof, recovery proof, and final authorization are prerequisites.
    service = gcloud('run', 'services', 'describe', 'pb-dashboard', '--region=' + REGION)
    validate_service(service)
    updated = gcloud('run', 'services', 'update', 'pb-dashboard', '--region=' + REGION,
                     '--image=' + IMAGE + '@' + digest, '--no-traffic', '--async')
    print(json.dumps({'builderBuild': build_id, 'commit': sha, 'digest': digest,
                      'service': updated.get('metadata', {}).get('name'), 'trafficShifted': False}))
    # Traffic remains a separate, explicitly authorized operation after revision QA.

if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Avoid echoing provider payloads, credentials, or command stderr.
        print('Promotion stopped: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__))
        raise SystemExit(1)
