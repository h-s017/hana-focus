#!/usr/bin/env python3
"""Bounded GET-only Notion review. No remote writes or inferred approvals."""
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
PAGE_ID = '3fc9b41981ae8112bef6d0aa5b9616e3'
API = 'https://api.notion.com/v1'
OUTPUT = ROOT / 'agent_output/notion-connection-review.md'
STATUSES = {'未開始', '進行中', '等待中', '完成'}
SETUP = 'NOTION_API_TOKEN 未設定；未連線 Notion。請依 agents/NOTION_SETUP.md 設定唯讀整合與 Actions secret；勿貼到聊天或 Issue。'

class ReviewError(Exception):
    pass

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward credentials to another host.

def page_id(value):
    value = str(value).replace('-', '')
    if not re.fullmatch(r'[0-9a-f]{32}', value):
        raise ReviewError('Invalid page mapping')
    return value

def timestamp(value):
    try:
        result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result.astimezone(dt.timezone.utc).isoformat() if result.tzinfo else None
    except (ValueError, TypeError, AttributeError):
        return None

def status(value):
    return value if isinstance(value, str) and value in STATUSES else None

def request(path, token, params=None):
    if not re.fullmatch(r'/(pages/[0-9a-f]{32}|blocks/[0-9a-f]{32}/children)', path):
        raise ReviewError('Unsupported read operation')
    req = Request(API + path + ('?' + urlencode(params) if params else ''), method='GET', headers={
        'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Accept': 'application/json'})
    with build_opener(NoRedirect()).open(req, timeout=20) as response:
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise ReviewError('Response limit exceeded')
    return json.loads(body)

def block_text(block):
    payload = block.get(block.get('type'), {})
    rich = payload.get('rich_text', [])
    if block.get('type') == 'table_row':
        rich = [part for cell in payload.get('cells', []) for part in cell]
    return ''.join(part.get('plain_text') or part.get('text', {}).get('content', '') for part in rich)

def collect_blocks(token, block_id, fetch=request):
    """Parse text in memory, retain only coverage counts. Fail on partial reads."""
    pending = [(page_id(block_id), 0)]
    visited = set()
    count = calls = text_blocks = 0
    while pending:
        current, depth = pending.pop()
        if current in visited:
            raise ReviewError('Repeated block')
        visited.add(current)
        cursor = None
        cursors = set()
        while True:
            calls += 1
            if calls > 40:
                raise ReviewError('Read budget exceeded')
            args = {'page_size': 100}
            if cursor:
                args['start_cursor'] = cursor
            data = fetch('/blocks/' + current + '/children', token, args)
            for block in data['results']:
                count += 1
                if count > 1000:
                    raise ReviewError('Block budget exceeded')
                text_blocks += bool(block_text(block))
                if block.get('has_children'):
                    if depth >= 3:
                        raise ReviewError('Depth limit reached')
                    pending.append((page_id(block['id']), depth + 1))
            if not data.get('has_more'):
                break
            cursor = data.get('next_cursor')
            if not isinstance(cursor, str) or not cursor or cursor in cursors:
                raise ReviewError('Invalid pagination')
            cursors.add(cursor)
    return {'blocks': count, 'text_blocks': text_blocks}

def remote_status(page):
    prop = page.get('properties', {}).get('狀態', {})
    kind = prop.get('type')
    return status((prop.get(kind) or {}).get('name')) if kind in ('status', 'select') else None

def compare_task(task, remote=None):
    baseline = task.get('notion_snapshot', {})
    before = status(baseline.get('status'))
    after = remote_status(remote) if remote else None
    old_time = timestamp(baseline.get('last_edited_at'))
    new_time = timestamp(remote.get('last_edited_time')) if remote else None
    return {'id': task['id'],
        'source_url': 'https://www.notion.so/' + page_id(task['notion_page_id']) if task.get('notion_page_id') else None,
        'snapshot_status': before, 'notion_status': after,
        'status_diff': 'unknown' if before is None or after is None else ('same' if before == after else 'changed'),
        'snapshot_last_edited_at': old_time, 'notion_last_edited_at': new_time,
        'timestamp_diff': 'unknown' if not old_time or not new_time else ('same' if old_time == new_time else 'changed'),
        'reason': 'no_mapping' if not task.get('notion_page_id') else ('status_or_baseline_unavailable' if before is None or after is None else 'explicit_status_property'),
        'review_required': True}

def review(project, token, fetch=request):
    if not token.strip():
        raise ReviewError(SETUP)
    if project.get('id') != 'wenqingji' or project.get('workspace') != 'work':
        raise ReviewError('Only wenqingji work project is permitted')
    tasks = project['tasks']
    if len(tasks) > 20 or any(not re.fullmatch(r'bkc-\d{2}', t.get('id', '')) for t in tasks):
        raise ReviewError('Invalid task snapshot')
    page = fetch('/pages/' + PAGE_ID, token)
    coverage = collect_blocks(token, PAGE_ID, fetch)
    rows = []
    for task in tasks:
        remote = fetch('/pages/' + page_id(task['notion_page_id']), token) if task.get('notion_page_id') else None
        rows.append(compare_task(task, remote))
    before = timestamp(project.get('notion_last_edited_at'))
    after = timestamp(page.get('last_edited_time'))
    return {'source_url': 'https://www.notion.so/' + PAGE_ID,
        'snapshot_last_edited_at': before, 'notion_last_edited_at': after,
        'timestamp_diff': 'unknown' if not before or not after else ('same' if before == after else 'changed'),
        'coverage': coverage, 'tasks': rows}

def render(result):
    # Only local IDs/URLs and validated enums/timestamps reach the report.
    lines = ['# Notion 唯讀差異審核', '', 'API 讀取成功；不代表同步、核准或任務完成。',
        '來源：' + result['source_url'],
        'GitHub 快照時間：' + str(result['snapshot_last_edited_at']),
        'Notion 頁面時間：' + str(result['notion_last_edited_at']),
        '頁面時間差異：' + result['timestamp_diff'],
        '讀取覆蓋：' + str(result['coverage']['blocks']) + ' blocks；中心頁時間相同不保證關聯任務未變更。',
        '', '## 結構化任務差異（不搜尋標題／內文）', '']
    for row in result['tasks']:
        lines += ['### ' + row['id'], '- 來源：' + str(row['source_url']),
            '- GitHub Notion 基準狀態：' + str(row['snapshot_status']),
            '- Notion 狀態欄：' + str(row['notion_status']),
            '- 狀態差異：' + row['status_diff'] + '；原因：' + row['reason'],
            '- 快照／Notion 編輯時間：' + str(row['snapshot_last_edited_at']) + ' / ' + str(row['notion_last_edited_at']),
            '- 時間差異：' + row['timestamp_diff'],
            '- [ ] 待 HANA 核對；即使 Notion 標示完成也不自動驗收。', '']
    lines += ['## 人工核准', '所有關卡仍待核准；勾選框不是核准證據。']
    lines += ['- [ ] ' + g + ' 待 HANA 檢視證據' for g in ('G1 策略', 'G2 識別', 'G3 商務範圍', 'G4 製作', 'G5 交付')]
    lines += ['', 'B/C 包裝方案不得由此報告判定。沒有回寫 Notion、修改快照、發布 Pages 或對外發送。',
        'None／unknown 表示證據不足，並非未完成或沒有變更。', '']
    return '\n'.join(lines)

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.unlink(missing_ok=True)
    token = os.environ.get('NOTION_API_TOKEN', '').strip()
    if not token:
        OUTPUT.write_text('# Notion 未連線\n\n' + SETUP + '\n', encoding='utf-8')
        print(SETUP)
        return 2
    try:
        data = json.loads((ROOT / 'agent_data/projects.json').read_text(encoding='utf-8'))
        project = next(p for p in data['projects'] if p['id'] == 'wenqingji')
        OUTPUT.write_text(render(review(project, token)), encoding='utf-8')
    except HTTPError as exc:
        message = 'Notion HTTP ' + str(exc.code) + '; check read access and page connections.' if exc.code in (401, 403, 404, 429) else 'Notion HTTP request failed.'
        OUTPUT.write_text('# Notion 讀取失敗\n\n' + message + '\n未完成比對；待 HANA 處理。\n', encoding='utf-8')
        print(message)
        return 1
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError, StopIteration, ReviewError):
        message = 'Notion review incomplete: connection, response, coverage or snapshot validation failed.'
        OUTPUT.write_text('# Notion 讀取失敗\n\n' + message + '\n', encoding='utf-8')
        print(message)
        return 1
    print('Notion read-only review generated; manual review required; no remote writes.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
