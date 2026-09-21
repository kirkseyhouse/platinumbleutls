import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('promotion', pathlib.Path(__file__).parents[1] / 'scripts' / 'promotion.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class PromotionTest(unittest.TestCase):
    def setUp(self):
        self.sha = 'a' * 40
        self.digest = 'sha256:' + 'b' * 64
        self.build = {'projectId': p.PROJECT, 'status': 'SUCCESS', 'buildTriggerId': 'builder-id',
                      'serviceAccount': p.BUILDER, 'substitutions': {'COMMIT_SHA': self.sha},
                      'sourceProvenance': {'resolvedRepoSource': {'commitSha': self.sha}},
                      'results': {'images': [{'name': p.IMAGE + ':' + self.sha, 'digest': self.digest}]}}
    def test_exact_build_is_accepted(self):
        p.validate_build(self.build, self.sha, self.digest, 'builder-id')
    def service(self):
        env = {'NODE_ENV': 'production', 'OPERATIONAL_MODE': 'hcp_coexistence',
               'APP_ORIGIN': 'https://ops.platinumbleutls.com',
               'INSTANCE_CONNECTION_NAME': 'platinum-bleu-drive:us-central1:pb-prod-sql',
               'DB_NAME': 'platinum_bleu', 'DB_IAM_USER': 'pb-dashboard-runtime@platinum-bleu-drive.iam',
               'NOTION_OPERATIONS_DATA_SOURCE_ID': '5744f794-ce07-4893-b477-4fbdc7b54a3f',
               'NOTION_EXPECTED_WORKSPACE_NAME': 'Platinum Bleu'}
        entries = [{'name': k, 'value': v} for k, v in env.items()]
        entries += [
            {'name': 'GOOGLE_CLIENT_ID', 'valueFrom': {'secretKeyRef': {'name': 'pb-google-client-id', 'key': '7'}}},
            {'name': 'GOOGLE_CLIENT_SECRET', 'valueFrom': {'secretKeyRef': {'name': 'pb-google-client-secret', 'key': '9'}}},
            {'name': 'NOTION_TOKEN', 'valueFrom': {'secretKeyRef': {'name': 'pb-notion-token', 'key': '11'}}},
        ]
        return {'metadata': {'name': 'pb-dashboard', 'annotations': {'run.googleapis.com/ingress': 'internal-and-cloud-load-balancing'}},
                'spec': {'template': {'metadata': {'annotations': {
                    'run.googleapis.com/network-interfaces': '[{"network":"pb-prod-vpc","subnetwork":"pb-prod-us-central1","tags":"pb-dashboard"}]',
                    'run.googleapis.com/vpc-access-egress': 'private-ranges-only',
                    'autoscaling.knative.dev/maxScale': '5'}}, 'spec': {
                    'serviceAccountName': 'pb-dashboard-runtime@platinum-bleu-drive.iam.gserviceaccount.com',
                    'containerConcurrency': 8, 'containers': [{'env': entries}]}}}}
    def test_service_requires_private_iam_database_and_bounded_capacity(self):
        p.validate_service(self.service())
        for name, value in [('DB_IAM_USER', 'pb-dashboard-migrate@platinum-bleu-drive.iam'),
                            ('DB_NAME', 'other'), ('INSTANCE_CONNECTION_NAME', 'other:region:sql'),
                            ('NODE_ENV', 'development'), ('APP_ORIGIN', 'https://other.example'),
                            ('OPERATIONAL_MODE', 'custom'),
                            ('NOTION_OPERATIONS_DATA_SOURCE_ID', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
                            ('NOTION_EXPECTED_WORKSPACE_NAME', 'Other Workspace'),
                            ('DATABASE_URL', ''), ('MIGRATION_DATABASE_URL', '')]:
            service = self.service()
            env = service['spec']['template']['spec']['containers'][0]['env']
            env[:] = [e for e in env if e['name'] != name] + [{'name': name, 'value': value}]
            with self.subTest(name=name), self.assertRaises(ValueError): p.validate_service(service)
        for name, value in [('run.googleapis.com/network-interfaces', '[{"network":"default","subnetwork":"default","tags":"pb-dashboard"}]'),
                            ('run.googleapis.com/vpc-access-egress', 'all-traffic'),
                            ('autoscaling.knative.dev/maxScale', '100')]:
            service = self.service()
            service['spec']['template']['metadata']['annotations'][name] = value
            with self.subTest(name=name), self.assertRaises(ValueError): p.validate_service(service)
        for name, entry in [
            ('GOOGLE_CLIENT_ID', {'name': 'GOOGLE_CLIENT_ID', 'value': 'literal'}),
            ('GOOGLE_CLIENT_SECRET', {'name': 'GOOGLE_CLIENT_SECRET', 'valueFrom': {'secretKeyRef': {'name': 'pb-google-client-secret', 'key': 'latest'}}}),
            ('GOOGLE_CLIENT_ID', {'name': 'GOOGLE_CLIENT_ID', 'valueFrom': {'secretKeyRef': {'name': 'wrong', 'key': '7'}}}),
            ('NOTION_TOKEN', {'name': 'NOTION_TOKEN', 'value': 'literal'}),
            ('NOTION_TOKEN', {'name': 'NOTION_TOKEN', 'valueFrom': {'secretKeyRef': {'name': 'pb-notion-token', 'key': 'latest'}}}),
            ('NOTION_TOKEN', {'name': 'NOTION_TOKEN', 'valueFrom': {'secretKeyRef': {'name': 'wrong', 'key': '11'}}}),
        ]:
            service = self.service()
            env = service['spec']['template']['spec']['containers'][0]['env']
            env[:] = [item for item in env if item['name'] != name] + [entry]
            with self.subTest(secret=name, entry=entry), self.assertRaises(ValueError): p.validate_service(service)
        for path, value in [
            ('service', 'other'), ('ingress', 'all'), ('identity', 'other@example.iam.gserviceaccount.com'),
            ('concurrency', 80), ('containers', []),
        ]:
            service = self.service()
            if path == 'service': service['metadata']['name'] = value
            elif path == 'ingress': service['metadata']['annotations']['run.googleapis.com/ingress'] = value
            elif path == 'identity': service['spec']['template']['spec']['serviceAccountName'] = value
            elif path == 'concurrency': service['spec']['template']['spec']['containerConcurrency'] = value
            elif path == 'containers': service['spec']['template']['spec']['containers'] = value
            with self.subTest(path=path), self.assertRaises(ValueError): p.validate_service(service)
    def test_connected_repository_provenance_is_accepted(self):
        self.build['sourceProvenance'] = {'resolvedConnectedRepository': {'revision': self.sha}}
        p.validate_build(self.build, self.sha, self.digest, 'builder-id')
    def test_rejects_forged_or_incomplete_build(self):
        for field, value in [('status', 'WORKING'), ('serviceAccount', 'attacker'), ('buildTriggerId', 'other'), ('projectId', 'other')]:
            with self.subTest(field=field):
                build = copy.deepcopy(self.build)
                build[field] = value
                with self.assertRaises(ValueError): p.validate_build(build, self.sha, self.digest, 'builder-id')
        with self.assertRaises(ValueError): p.validate_build(self.build, 'c' * 40, self.digest, 'builder-id')
        with self.assertRaises(ValueError): p.validate_build(self.build, self.sha, 'latest', 'builder-id')
        build = copy.deepcopy(self.build)
        build.pop('sourceProvenance')
        with self.assertRaises(ValueError): p.validate_build(build, self.sha, self.digest, 'builder-id')
    def test_scan_must_be_complete_and_without_high_or_unknown_findings(self):
        good = [{'kind': 'DISCOVERY', 'discovery': {'analysisStatus': 'FINISHED_SUCCESS'}}]
        self.assertTrue(p.scan_clean(good))
        self.assertFalse(p.scan_clean([]))
        self.assertFalse(p.scan_clean([{'kind': 'DISCOVERY', 'discovery': {'analysisStatus': 'PENDING'}}]))
        for severity in ['HIGH', 'CRITICAL', 'SEVERITY_UNSPECIFIED', None]:
            with self.subTest(severity=severity), self.assertRaises(ValueError):
                p.scan_clean(good + [{'kind': 'VULNERABILITY', 'vulnerability': {'effectiveSeverity': severity}}])
        self.assertTrue(p.scan_clean(good + [{'kind': 'VULNERABILITY', 'vulnerability': {'effectiveSeverity': 'LOW'}}]))
    def test_approval_identity_and_trigger_must_match(self):
        approved = {'buildTriggerId': 'promoter-id', 'serviceAccount': p.DEPLOYER,
                    'approval': {'state': 'APPROVED', 'result': {'decision': 'APPROVED', 'approverAccount': 'owner@example.com'}}}
        p.validate_approval(approved, 'promoter-id', 'owner@example.com')
        for state in ['PENDING', 'REJECTED', None]:
            bad = copy.deepcopy(approved)
            bad['approval']['state'] = state
            with self.assertRaises(ValueError): p.validate_approval(bad, 'promoter-id', 'owner@example.com')
        with self.assertRaises(ValueError): p.validate_approval(approved, 'other', 'owner@example.com')
        with self.assertRaises(ValueError): p.validate_approval(approved, 'promoter-id', 'other@example.com')

if __name__ == '__main__': unittest.main()
