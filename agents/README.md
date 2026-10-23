# HANA FOCUS｜Project Manager Agent V1

## 現階段能力
以版本庫內 `agent_data/projects.json` 為輸入，產出文慶雞任務優先序、資料品質檢查與人工審核清單。

## 執行
`python agents/project_manager.py --project wenqingji`

或 GitHub Actions → **Project Manager Review** → Run workflow（若該工作流程已可手動執行）。
推送此目錄的檔案到 `hana-focus-preview` 亦會自動執行。
完成後在 workflow run 的 **Artifacts** 下載 `project-manager-review`。

## 安全界線
- 僅讀取 GitHub 版本庫內的專案快照，不直接讀取 Notion 或 Google Docs。
- 這是規則式專案管理執行器，**尚未串接 LLM**，不應宣稱有生成式 AI 推理。
- 不自動修改外部資料、不建立正式交付、不替 HANA 核准。
- 工作板 localStorage 不會自動同步到此 JSON；需要後續建置授權資料介面。
- 文慶雞資料是待核對的初始快照，不代表最新實際進度。

## 文慶雞｜品牌識別手冊 V1.0（2026-10-23）

- [Agent 三角色交接與審閱規格](./WENQINGJI_MANUAL_V1_HANDOFF.md)
- [Notion 內部手冊審閱基準](https://app.notion.com/p/4029b41981ae8161bda0eb5f9f3adc76?pvs=204)
- `agent_data/projects.json` 已登錄 `bkc-06` Project Manager、`bkc-07` Brand Strategist、`bkc-08` Creative Producer。
- 此為工作規格與規則式 PM 快照更新。**Brand Strategist／Creative Producer 尚未部署可自動執行的 Agent**；手冊仍待 HANA 審核，PDF/DOCX 尚未確認上傳至共享雲端。
