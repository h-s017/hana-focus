import contextlib
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from agents import notion_readonly as n
from agents import project_manager as pm

ROOT = Path(__file__).resolve().parents[1]
TOKEN = 'secret-fixture-must-never-appear'
PRIVATE = 'confidential-notion-body'
ID = 'a' * 32
STAMP = '2026-10-17T16:02:32.870Z'

def remote(state='等待中'):
    return {'last_edited_time': STAMP, 'properties': {'狀態': {'type':'status','status':{'name':state}}}, 'private': PRIVATE}

def task():
    return {'id':'bkc-01','notion_page_id': ID, 'notion_snapshot':{'status':'等待中','last_edited_at':STAMP}}

def project():
    return {'id':'wenqingji','workspace':'work','notion_last_edited_at':STAMP,'tasks':[task()]}

class BlocksTests(unittest.TestCase):
    def test_rich_text_fallback_and_table(self):
        self.assertEqual(n.block_text({'type':'paragraph','paragraph':{'rich_text':[{'plain_text':'甲'},{'text':{'content':'乙'}}]}}),'甲乙')
        self.assertEqual(n.block_text({'type':'table_row','table_row':{'cells':[[{'plain_text':'丙'}],[{'text':{'content':'丁'}}]]}}),'丙丁')
        self.assertEqual(n.block_text({'type':'image','image':{}}),'')

    def test_paginated_nested_coverage_without_raw_text(self):
        fetch=Mock(side_effect=[{'results':[{'type':'paragraph','paragraph':{'rich_text':[{'plain_text':PRIVATE}]},'has_children':True,'id':ID}], 'has_more':True,'next_cursor':'cursor-2'}, {'results':[], 'has_more':False}, {'results':[], 'has_more':False}])
        got=n.collect_blocks(TOKEN,n.PAGE_ID,fetch)
        self.assertEqual(got,{'blocks':1,'text_blocks':1})
        self.assertEqual(fetch.call_args_list[1].args[2]['start_cursor'],'cursor-2')
        self.assertEqual(fetch.call_args_list[2].args[0],'/blocks/'+ID+'/children')
        self.assertNotIn(PRIVATE,json.dumps(got))

    def test_missing_cursor_is_failure(self):
        with self.assertRaises(n.ReviewError):
            n.collect_blocks(TOKEN,ID,Mock(return_value={'results':[],'has_more':True}))

    def test_repeated_cursor_is_failure(self):
        with self.assertRaises(n.ReviewError):
            n.collect_blocks(TOKEN,ID,Mock(return_value={'results':[],'has_more':True,'next_cursor':'repeat'}))

    def test_depth_limit_is_not_silent_success(self):
        counter=iter(['b'*32,'c'*32,'d'*32,'e'*32])
        def fetch(*args):
            return {'results':[{'id':next(counter),'has_children':True}], 'has_more':False}
        with self.assertRaises(n.ReviewError):
            n.collect_blocks(TOKEN,ID,fetch)

    def test_block_budget(self):
        with self.assertRaises(n.ReviewError):
            n.collect_blocks(TOKEN,ID,Mock(return_value={'results':[{}]*1001,'has_more':False}))

class DiffTests(unittest.TestCase):
    def test_same_and_equivalent_timestamp(self):
        r=remote(); r['last_edited_time']='2026-10-18T00:02:32.870+08:00'
        got=n.compare_task(task(),r)
        self.assertEqual(got['status_diff'],'same'); self.assertEqual(got['timestamp_diff'],'same')
        self.assertTrue(got['review_required'])

    def test_changed_status_not_auto_completion(self):
        got=n.compare_task(task(),remote('完成'))
        self.assertEqual(got['status_diff'],'changed'); self.assertTrue(got['review_required'])
        self.assertNotIn('approved',got)

    def test_title_mentions_do_not_determine_status(self):
        r={'properties':{'title':{'title':[{'plain_text':'bkc-01 已完成 完成'}]}},'last_edited_time':STAMP}
        self.assertIsNone(n.compare_task(task(),r)['notion_status'])

    def test_absent_baseline_unknown(self):
        t=task(); t['notion_snapshot']={}
        self.assertEqual(n.compare_task(t,remote())['status_diff'],'unknown')

    def test_unmapped_task_unknown(self):
        t=task(); t['notion_page_id']=None
        got=n.compare_task(t)
        self.assertEqual(got['reason'],'no_mapping'); self.assertIsNone(got['source_url'])

    def test_unknown_status_redacted(self):
        got=n.compare_task(task(),remote(PRIVATE))
        self.assertIsNone(got['notion_status']); self.assertNotIn(PRIVATE,str(got))

    def test_invalid_timestamp_redacted(self):
        r=remote();r['last_edited_time']=PRIVATE
        self.assertIsNone(n.compare_task(task(),r)['notion_last_edited_at'])

    def test_select_property_supported(self):
        r={'properties':{'狀態':{'type':'select','select':{'name':'進行中'}}}}
        self.assertEqual(n.remote_status(r),'進行中')

    def test_review_keeps_child_diffs_when_root_time_same(self):
        fetch=Mock(side_effect=[{'last_edited_time':STAMP}, {'results':[],'has_more':False}, remote('完成')])
        result=n.review(project(),TOKEN,fetch)
        self.assertEqual(result['timestamp_diff'],'same')
        self.assertEqual(result['tasks'][0]['status_diff'],'changed')
        text=n.render(result)
        self.assertNotIn(TOKEN,text);self.assertNotIn(PRIVATE,text)
        self.assertIn('B/C',text)
        for g in ('G1','G2','G3','G4','G5'):self.assertIn(g,text)

    def test_missing_token_never_calls_api(self):
        fetch=Mock()
        with self.assertRaises(n.ReviewError):n.review(project(),' ',fetch)
        fetch.assert_not_called()

    def test_workspace_isolation(self):
        p=project();p['workspace']='church'
        fetch=Mock()
        with self.assertRaises(n.ReviewError):n.review(p,TOKEN,fetch)
        fetch.assert_not_called()

class TransportTests(unittest.TestCase):
    def test_only_get_and_no_redirect(self):
        response=Mock();response.read.return_value=b'{}'
        opener=Mock();opener.open.return_value.__enter__=Mock(return_value=response)
        opener.open.return_value.__exit__=Mock(return_value=False)
        with patch.object(n,'build_opener',return_value=opener):
            self.assertEqual(n.request('/pages/'+ID,TOKEN),{})
        req=opener.open.call_args.args[0]
        self.assertEqual(req.get_method(),'GET')
        self.assertTrue(req.full_url.startswith(n.API))
        self.assertIsNone(n.NoRedirect().redirect_request(req,None,302,'',{},'https://evil.test'))

    def test_reject_unexpected_endpoint(self):
        with patch.object(n,'build_opener') as opener:
            with self.assertRaises(n.ReviewError):n.request('/search',TOKEN)
            opener.assert_not_called()

class MainTests(unittest.TestCase):
    def run_main(self,token,error=None):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'report.md';out.write_text('stale successful report')
            with patch.object(n,'OUTPUT',out),patch.dict(os.environ,{'NOTION_API_TOKEN':token}),patch.object(n,'review',side_effect=error) as review,contextlib.redirect_stdout(io.StringIO()) as stdout:
                code=n.main()
            return code,out.read_text(),stdout.getvalue(),review.call_count

    def test_no_secret_safe_report_and_nonzero(self):
        code,text,stdout,calls=self.run_main('')
        self.assertEqual(code,2);self.assertEqual(calls,0)
        self.assertIn('未連線',text);self.assertNotIn('stale',text)

    def test_403_404_401_429_safe_failure(self):
        for code in (401,403,404,429):
            error=HTTPError('https://private.test/'+TOKEN,code,PRIVATE,{},None)
            result,text,stdout,_=self.run_main(TOKEN,error)
            self.assertEqual(result,1);self.assertIn(str(code),text)
            for secret in (TOKEN,PRIVATE,'stale'):
                self.assertNotIn(secret,text+stdout)

    def test_network_and_malformed_errors_do_not_leak(self):
        for error in (URLError(TOKEN),ValueError(PRIVATE),n.ReviewError(TOKEN),TimeoutError(PRIVATE)):
            code,text,stdout,_=self.run_main(TOKEN,error)
            self.assertEqual(code,1);self.assertNotIn(TOKEN,text+stdout);self.assertNotIn(PRIVATE,text+stdout)

class PMTests(unittest.TestCase):
    def setUp(self):
        self.p=json.loads((ROOT/'agent_data/projects.json').read_text())['projects'][0]

    def test_snapshot_gates_and_top_three(self):
        report=pm.build_report(self.p)
        part=report.split('## 今日建議')[1].split('## G1')[0]
        self.assertEqual(part.count('\n- '),3)
        for g in ('G1','G2','G3','G4','G5'):self.assertIn(g,report)
        self.assertIn('B/C',report);self.assertIn('未即時讀取',report)

    def test_completed_task_not_recommended(self):
        self.p['tasks'][0]['status']='已完成'
        report=pm.build_report(self.p).split('## 今日建議')[1].split('## G1')[0]
        self.assertNotIn('bkc-01',report)

    def test_missing_gate_stays_unknown(self):
        self.p['review_gates']=[]
        self.assertEqual(pm.build_report(self.p).count('快照狀態：未知'),5)

    def test_other_workspace_rejected(self):
        self.p['workspace']='church'
        with self.assertRaises(ValueError):pm.build_report(self.p)

if __name__=='__main__':unittest.main()
