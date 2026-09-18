"""Render the immutable inline promotion payload; --check detects drift."""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
program = (root / 'scripts/promotion.py').read_text(encoding='utf-8')
# JSON is a YAML subset accepted by Cloud Build and avoids a YAML runtime dependency.
config = {
    'timeout': '1200s',
    'serviceAccount': 'projects/platinum-bleu-drive/serviceAccounts/pb-dashboard-deployer@platinum-bleu-drive.iam.gserviceaccount.com',
    'logsBucket': 'gs://platinum-bleu-drive-pb-promote-logs',
    'options': {'logging': 'GCS_ONLY', 'logStreamingOption': 'STREAM_OFF', 'substitutionOption': 'MUST_MATCH'},
    'substitutions': {'_COMMIT_SHA': 'REQUIRED_COMMIT_SHA', '_IMAGE_DIGEST': 'REQUIRED_DIGEST', '_BUILDER_BUILD_ID': 'REQUIRED_BUILD_ID'},
    'steps': [{
        'id': 'verify-approved-digest-and-create-revision',
        'name': 'gcr.io/google.com/cloudsdktool/google-cloud-cli:578.0.0-slim@sha256:70f3244ccf80a83c23805b5ff9f0b1a88d57b3fd07831d57a311e70625b289e9',
        'entrypoint': 'python3',
        'env': ['PB_COMMIT=${_COMMIT_SHA}', 'PB_DIGEST=${_IMAGE_DIGEST}', 'PB_BUILDER_ID=${_BUILDER_BUILD_ID}', 'PB_PROMOTION_ID=$BUILD_ID'],
        'args': ['-c', program],
    }],
}
target = root / 'cloudbuild-promote.yaml'
expected = json.dumps(config, indent=2) + '\n'
if '--check' in sys.argv:
    if not target.exists() or target.read_text(encoding='utf-8') != expected:
        raise SystemExit('Inline promotion configuration is stale; run python scripts/render-cloud-build.py')
    print('Inline promotion configuration matches reviewed source.')
else:
    target.write_text(expected, encoding='utf-8', newline='\n')
