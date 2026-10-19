"""PR #6 regressions: pagination, safe failures and metadata-only comparison."""
import contextlib
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from agents import notion_readonly as notion

class NotionReadOnlyTests(unittest.TestCase):
    def test_pagination(self):
        responses = iter([
            {'results':[{'type':'paragraph','paragraph':{'rich_text':[{'plain_text':'first'}]}}], 'has_more':True,'next_cursor':'cursor-2'},
            {'results':[{'type':'paragraph','paragraph':{'rich_text':[{'plain_text':'second'}]}}], 'has_more':False},
        ])
        with patch.object(notion,'request',side_effect=lambda *a,**kw:next(responses)) as api:
            result=notion.collect_blocks('fixture',notion.PAGE_ID)
            self.assertEqual(result,{'blocks':2,'text_blocks':2})
            self.assertEqual(api.call_args_list[1].args[2]['start_cursor'],'cursor-2')
            self.assertNotIn('first',str(result))

    def test_nested_blocks(self):
        child='a'*32
        def fake(path,token,params=None):
            if path.endswith('/'+notion.PAGE_ID+'/children'):
                return {'results':[{'id':child,'type':'toggle','toggle':{'rich_text':[{'plain_text':'parent'}]},'has_children':True}], 'has_more':False}
            return {'results':[{'type':'paragraph','paragraph':{'rich_text':[{'plain_text':'nested'}]}}], 'has_more':False}
        with patch.object(notion,'request',side_effect=fake):
            self.assertEqual(notion.collect_blocks('fixture',notion.PAGE_ID),{'blocks':2,'text_blocks':2})

    def test_missing_token(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'NOTION_API_TOKEN':''}), patch.object(notion,'OUTPUT',Path(tmp)/'report.md'), patch.object(notion,'request') as api, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(notion.main(),2)
            self.assertIn('未連線',notion.OUTPUT.read_text())
            api.assert_not_called()

    def test_http_errors_are_safe(self):
        for code in (403,404):
            with self.subTest(code=code),tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'NOTION_API_TOKEN':'secret-fixture'}),patch.object(notion,'OUTPUT',Path(tmp)/'report.md'),patch.object(notion,'request',side_effect=HTTPError('https://private.test',code,'secret-fixture',{},None)),contextlib.redirect_stdout(io.StringIO()) as stdout:
                self.assertEqual(notion.main(),1)
                report=notion.OUTPUT.read_text()
                self.assertIn(str(code),report)
                self.assertNotIn('secret-fixture',report+stdout.getvalue())

    def test_structured_change_detection(self):
        snapshot={'notion_last_edited_at':'2026-10-17T00:00:00Z'}
        result=notion.compare_snapshot(snapshot,{'last_edited_time':'2026-10-18T00:00:00Z'})
        self.assertTrue(result['page_changed'])
        self.assertEqual(result['task_status'],'not_verified')
        self.assertFalse(notion.compare_snapshot(snapshot,{'last_edited_time':'2026-10-17T00:00:00Z'})['page_changed'])
        self.assertIsNone(notion.compare_snapshot({}, {})['page_changed'])

class ValidationRegressionTests(unittest.TestCase):
    def project(self):
        return {'id':'wenqingji','workspace':'work','tasks':[{'id':'bkc-01','notion_page_id':notion.TASK_PAGES['bkc-01']} ]}

    def test_mapping_cannot_expand_read_scope(self):
        p=self.project();p['tasks'][0]['notion_page_id']='f'*32
        api=Mock()
        with self.assertRaises(notion.ReviewError):notion.review(p,'fixture',api)
        api.assert_not_called()

    def test_duplicate_task_ids_rejected_before_read(self):
        p=self.project();p['tasks']*=2
        api=Mock()
        with self.assertRaises(notion.ReviewError):notion.review(p,'fixture',api)
        api.assert_not_called()

    def test_malformed_metadata_not_success(self):
        with self.assertRaises(notion.ReviewError):
            notion.review(self.project(),'fixture',Mock(return_value={'last_edited_time':'2026-10-18T00:00:00Z'}))

    def test_malformed_block_envelope(self):
        for response in ({}, {'results':[], 'has_more':'false'}, {'results':{},'has_more':False}):
            with self.assertRaises(notion.ReviewError):
                notion.collect_blocks('fixture',notion.PAGE_ID,Mock(return_value=response))

    def test_main_success_still_requires_review(self):
        def api(path,token,params=None):
            if path.startswith('/blocks/'):
                return {'results':[],'has_more':False}
            return {'object':'page','last_edited_time':'2026-10-18T00:00:00Z','properties':{'狀態':{'type':'status','status':{'name':'完成'}}}}
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'NOTION_API_TOKEN':'fixture-secret'}),patch.object(notion,'OUTPUT',Path(tmp)/'report.md'),patch.object(notion,'request',side_effect=api),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(notion.main(),0)
            report=notion.OUTPUT.read_text()
            self.assertIn('待 HANA',report)
            self.assertIn('unknown',report)  # No approved structured baseline.
            self.assertNotIn('fixture-secret',report)

if __name__=='__main__':unittest.main()
