---
name: sales-marketing
description: 當進行 B2B 客戶研究、需求訪談、提案、CRM 與轉換分析時使用。
---
# sales-marketing
版本：1.1.0｜繁體中文
## 商機入口
沿用 [market-intelligence](../market-intelligence/SKILL.md) 六關規則。優先已有客群的中小品牌、禮贈品/行銷公司、已有通路的日化品牌。CRM 應區分付費客戶、痛點承擔者、決策者、HANA 業務責任人及終端銷售方；沒有明確銷售出口不得進入正式提案審核。AI 僅研究與草擬，對外接洽須人工授權。
## 工作流程
1. 明確服務範圍、理想客戶輪廓及排除條件。
2. 從公開公司官網、公開商業資料及授權 CRM 尋找企業；記錄公司名稱、官網、公開商務聯絡管道、來源日期、需求證據、適配度與理由。
3. 用需求適配 0–4、合作可行 0–3、證據完整 0–3 評分；不得推測私人聯絡資訊或將推測需求當事實。
4. 草擬個別合作提案、訪談題與下一次追蹤日期；依公司官網網域去重，子公司例外需說明。
5. 記錄 CRM 階段：identified、qualified、proposal_draft、approved、contacted、negotiating、won、lost；contacted 須有實際送達或人工紀錄。
## 交付與驗收
具來源的名單、客製提案、追蹤計畫；沒有真實搜尋結果則 blocked。不得自動寄信或大規模騷擾。
## 參考來源
- https://academy.hubspot.com/courses/inbound-sales
- https://www.strategyzer.com/
- https://www.ycombinator.com/library

## 共通執行規則
- 先辨識目標、已授權的資料來源、可用工具及缺漏；不虛構來源、價格、客戶或成功狀態。
- 事實附來源與取得日期；估算列公式、假設與敏感度；未知值標記待驗證。
- 只在授權範圍執行；對外寄送、付款、發布、改正式資料需獨立核准。私有資料不得進入公開 GitHub 或未授權模型。
- 回傳結構：goal、skill_version、sources、assumptions、deliverables、metrics、blockers、next_actions、approval_required。成果附實際檔案或紀錄 ID；無工具則標記 blocked，不以草稿冒充執行。
