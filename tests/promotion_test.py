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
