#!/usr/bin/env python3
"""Read-only Notion status check. No credentials or page content are persisted."""
import datetime as dt
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PAGE_ID = "3fc9b41981ae8112bef6d0aa5b9616e3"
API = "https://api.notion.com/v1"
OUTPUT = ROOT / "agent_output" / "notion-connection-review.md"

def request(path, token, params=None):
    url = API + path + ("?" + urlencode(params) if params else "")
    req = Request(url, headers={
        "Authorization": "Bearer " + token,
        "Notion-Version": "2022-06-28",
        "Accept": "application/json",
    })
    with urlopen(req, timeout=20) as response:
        return json.load(response)

def collect_blocks(token, block_id, depth=0):
    """Read page blocks, including nested blocks, with pagination and bounded depth."""
    found = []
    cursor = None
    while True:
        args = {"page_size": 100}
        if cursor:
            args["start_cursor"] = cursor
        data = request("/blocks/" + block_id + "/children", token, args)
        for block in data.get("results", []):
            kind = block.get("type", "")
            rich = block.get(kind, {}).get("rich_text", [])
            text = "".join(item.get("plain_text", "") for item in rich)
            if text:
                found.append(text)
            if block.get("has_children") and depth < 2:
                found.extend(collect_blocks(token, block["id"], depth + 1))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break
    return found

def main():
    token = os.environ.get("NOTION_API_TOKEN", "").strip()
    if not token:
        raise SystemExit("NOTION_API_TOKEN is not configured. Add it in repository Actions secrets.")
    try:
        page = request("/pages/" + PAGE_ID, token)
        lines = collect_blocks(token, PAGE_ID)
    except HTTPError as e:
        raise SystemExit("Notion API returned HTTP " + str(e.code) + ". Check integration access to the page.")
    except (URLError, TimeoutError) as e:
        raise SystemExit("Notion connection failed: " + type(e).__name__)
    data = json.loads((ROOT / "agent_data" / "projects.json").read_text(encoding="utf-8"))
    project = next(p for p in data["projects"] if p["id"] == "wenqingji")
    page_text = "\n".join(lines)
    edited = page.get("last_edited_time", "unknown")
    snapshot = project.get("notion_last_edited_at", "unknown")
    OUT = OUTPUT
    OUT.parent.mkdir(exist_ok=True)
    report = [
        "# Notion read-only connection review",
        "",
        "- Project: 文慶雞",
        "- Checked (UTC): " + dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "- Notion page last edited: " + edited,
        "- GitHub snapshot last edited: " + snapshot,
        "- Changed since snapshot: " + ("YES — manual review required" if edited != snapshot else "No timestamp change detected"),
        "- Blocks read: " + str(len(lines)),
        "",
        "## Existing tasks: text mention check (not proof of completion)",
    ]
    for task in project["tasks"]:
        words = task["title"][:8]
        report.append("- " + task["id"] + ": " + ("text possibly present" if words in page_text else "not found by exact prefix") + " — " + task["title"])
    report += [
        "", "## Approval", "- [ ] HANA reviews changes in Notion before updating the GitHub snapshot.",
        "- [ ] HANA confirms contractual scope and visual decisions.",
        "", "No Notion content is copied into this report. This workflow never writes to Notion.",
    ]
    OUT.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Read-only Notion check succeeded. Report generated; no remote writes.")

if __name__ == "__main__":
    main()
