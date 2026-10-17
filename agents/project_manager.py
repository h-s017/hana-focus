#!/usr/bin/env python3
"""Deterministic Project Manager review report. No external writes or AI model calls."""
import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "agent_data" / "projects.json"
OUT = ROOT / "agent_output"

def build_report(project):
    tasks = project["tasks"]
    ordered = sorted(tasks, key=lambda t: (-int(t.get("priority", 0)), t["id"]))
    lines = [
        "# Project Manager｜" + project["name"],
        "",
        "產生時間（UTC）：" + dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "",
        "> 本報告依版本庫內的專案快照產生；未即時讀取 Notion 或 Google Docs，也未呼叫生成式 AI。",
        "> 所有建議均待 HANA 人工核對，不能視為正式指派或完成。",
        "",
        "## 資料來源",
        project.get("source", "未註明"),
    ]
    for ref in project.get("references", []):
        lines.append("- [" + ref["name"] + "](" + ref["url"] + ")")
    lines += ["", "## 任務優先序", "", "| 優先 | 任務 | 負責角色 | 目前狀態 | 交付物 |", "|---|---|---|---|---|"]
    for t in ordered:
        lines.append("| P" + str(4-int(t.get("priority", 1))) + " | " + t["title"] + " | " + t.get("owner","未指定") + " | " + t.get("status","未設定") + " | " + t.get("deliverable","待確認") + " |")
    lines += ["", "## 人工審核關卡", ""]
    for t in ordered:
        if t.get("review_required"):
            lines.append("- [ ] " + t["id"] + "｜" + t["title"] + "：由 HANA 核對資料、成果及下一步")
    lines += ["", "## 資料品質檢查", ""]
    for t in ordered:
        missing = [k for k in ("owner","status","deliverable") if not t.get(k)]
        if missing:
            lines.append("- " + t["id"] + " 缺少：" + "、".join(missing))
    if all(all(t.get(k) for k in ("owner","status","deliverable")) for t in ordered):
        lines.append("- 基本欄位齊全；實際進度、期限與資料正確性仍需核對")
    lines += ["", "## 執行限制", "- 此次僅產生報告檔，不會更新 GitHub Issues、Notion、網站或寄送訊息。", "- 任何對外行動需 HANA 另行批准。", ""]
    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="wenqingji")
    args = parser.parse_args()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    projects = [p for p in data["projects"] if p["id"] == args.project]
    if len(projects) != 1:
        parser.error("Unknown project: " + args.project)
    OUT.mkdir(exist_ok=True)
    report = build_report(projects[0])
    path = OUT / (args.project + "-review.md")
    path.write_text(report, encoding="utf-8")
    print("Report created:", path)
    print("Tasks:", len(projects[0]["tasks"]))

if __name__ == "__main__":
    main()
