from pathlib import Path
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
class WorkflowTests(unittest.TestCase):
    def load(self,name):
        # BaseLoader preserves GitHub's YAML 1.2 'on' key instead of YAML 1.1 bool.
        return yaml.load((ROOT/'.github/workflows'/name).read_text(),Loader=yaml.BaseLoader)

    def test_offline_ci_has_no_secret_or_deployment(self):
        d=self.load('project-manager-review.yml')
        self.assertIn('workflow_dispatch',d['on']);self.assertIn('pull_request',d['on'])
        self.assertEqual(d['permissions'],{'contents':'read'})
        steps=d['jobs']['review']['steps'];text=str(steps)
        self.assertIn('unittest discover',text)
        self.assertNotIn('secrets.',text);self.assertNotIn('deploy-pages',text)
        self.assertTrue(any(s.get('with',{}).get('path')=='agent_output/wenqingji-review.md' for s in steps))

    def test_notion_only_authorized_manual_and_min_permissions(self):
        d=self.load('notion-readonly-review.yml')
        self.assertEqual(list(d['on']),['workflow_dispatch'])
        self.assertEqual(d['permissions'],{'contents':'read'})
        j=d['jobs']['notion-review']
        self.assertIn('inputs.hana_review_authorized == true',j['if'])
        self.assertEqual(j['environment'],'notion-readonly')
        upload=j['steps'][-1]
        self.assertEqual(upload['if'],'always()')
        self.assertEqual(upload['with']['path'],'agent_output/notion-connection-review.md')
        self.assertEqual(upload['with']['retention-days'],'1')
        self.assertNotIn('deploy-pages',str(j));self.assertNotIn('git push',str(j))
