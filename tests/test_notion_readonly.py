"""Offline tests for the read-only Notion connector. Run: python -m unittest discover -s tests -v"""
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from agents import notion_readonly as notion

class NotionReadOnlyTests(unittest.TestCase):
    def test_pagination(self):
        responses = iter([
            {"results":[{"id":"a","type":"paragraph","paragraph":{"rich_text":[{"plain_text":"first"}]},"has_children":False}],"has_more":True,"next_cursor":"cursor-2"},
            {"results":[{"id":"b","type":"paragraph","paragraph":{"rich_text":[{"plain_text":"second"}]},"has_children":False}],"has_more":False}
        ])
        with patch.object(notion,"request",side_effect=lambda *a,**kw:next(responses)) as api:
            self.assertEqual(notion.collect_blocks("test","page"),["first","second"])
            self.assertEqual(api.call_args_list[1].args[0],"/blocks/page/children")
            self.assertEqual(api.call_args_list[1].args[2]["start_cursor"],"cursor-2")

    def test_nested_blocks(self):
        def fake(path,token,params=None):
            if path.endswith("/page/children"):
                return {"results":[{"id":"child","type":"toggle","toggle":{"rich_text":[{"plain_text":"parent"}]},"has_children":True}],"has_more":False}
            return {"results":[{"id":"leaf","type":"paragraph","paragraph":{"rich_text":[{"plain_text":"nested"}]},"has_children":False}],"has_more":False}
        with patch.object(notion,"request",side_effect=fake):
            self.assertEqual(notion.collect_blocks("test","page"),["parent","nested"])

    def test_missing_token(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaisesRegex(SystemExit,"NOTION_API_TOKEN"):
                notion.main()

    def test_http_errors_are_safe(self):
        for status in (403,404):
            with self.subTest(status=status),patch.dict(os.environ,{"NOTION_API_TOKEN":"SECRET"}):
                with patch.object(notion,"request",side_effect=HTTPError("https://api.notion.com",status,"denied",{},None)):
                    with self.assertRaises(SystemExit) as caught:
                        notion.main()
                    self.assertIn(str(status),str(caught.exception))
                    self.assertNotIn("SECRET",str(caught.exception))

    def test_structured_change_detection(self):
        snapshot={"notion_last_edited_at":"2026-10-17T00:00:00Z","tasks":[{"id":"bkc-01","title":"Task","status":"待核對"}]}
        result=notion.compare_snapshot(snapshot,{"last_edited_time":"2026-10-18T00:00:00Z"})
        self.assertTrue(result["page_changed"])
        self.assertEqual(result["task_status"],"not_verified")
        self.assertFalse(notion.compare_snapshot(snapshot,{"last_edited_time":"2026-10-17T00:00:00Z"})["page_changed"])

if __name__=="__main__":
    unittest.main()
