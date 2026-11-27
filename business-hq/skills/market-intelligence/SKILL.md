---
name: market-intelligence
description: 日化香氛市場趨勢、缺口驗證與產品商機組合，銜接銷售、研發、供應鏈與財務。
---
# Market Intelligence｜市場商機研究中心
版本 1.0.0｜2026-11-27
## 定位
隸屬 HANA BUSINESS HQ 銷售中心，HANA AI OFFICE 執行；涵蓋 B2B、B2G、B2C、B2B2C，優先 B2B。沿用既有任務、審核及 CRM，不另建系統。
## 三階段
1. 捕捉趨勢：每日觀察台灣及國際搜尋趨勢、新品、公開社群討論、產業資料。記錄來源 URL、日期、地區、指標、觀察期及可信度；搜尋熱度不等於銷量。
2. 找市場缺口：每週比對產品供需、競品、價格、MOQ、顧客抱怨、訪談、回購需求及替代品。區分已驗證事實、推論及待驗證假設；小量代工不視為天然差異化。
3. 快速組合答案：提出產品企劃、命名草案、定位、供應商候選、成本與報價草案、最小可行產品、驗證方式及上市草案。未審核不得對外發布、聯絡、採購或承諾。
## 初始觀察池（非已驗證商機）
- Fabric Scent：衣物香氛、洗衣香氛；服飾品牌、洗衣業者、選品店。
- Body Ritual：沐浴乳、身體乳、體香與髮部香氛；美容品牌、SPA、飯店。
- Home Ritual：居家清潔、除味、室內香氛；居家品牌、清潔用品商、生活通路。
- Signature Scent：專屬氣味、香氛商品、飯店備品、企業禮贈；企業、飯店、設計品牌。
- 個人香氛：迷你香水、香氣疊搭作為補充觀察方向。
## 缺口假設
產品企劃不足、MOQ 與資金門檻、跨載體氣味一致性、PIF/IFRA 文件協作、上市與銷售能力。逐一以實際詢單、訪談、競品報價驗證；不得直接宣稱市場規模或成長率，除非取得可核查原始來源。
## 評分
需求 25、競爭缺口 20、回購 15、毛利 15、低資金門檻 15、可複製性 10。各項以 0–5 評級乘權重/5，缺證據標記 unknown，不能用零替代；完整後才計總分。暫定 75 分以上進入人工驗證；法規、安全、供應可行性另設硬性關卡。
## 作業頻率與交付
每日監測；每週研究與最多三個具證據商機（不足則說明）；每月篩選產品與供應商。審核後轉銷售、研發、產、財：客戶輪廓及提案、產品規格與跨載體驗證、MOQ/交期/品質、單案成本毛利與現金流。化粧品及其他產品依用途與宣稱確認適用法規、文件及測試，不一律套用 PIF。
## 資料契約
opportunity_id, title, segment, product_category, trend_evidence, gap_evidence, hypothesis, sources, observation_period, competitors, customer_pain, proposed_solution, suppliers, MOQ, cost_assumptions, scoring, regulatory_gate, validation_plan, status, owner, next_action, approval_required。
狀態：observed → hypothesis → validated → proposal_draft → approved → pilot → reviewed；另有 blocked/rejected。保留歷史及來源，不將私有客戶/報價資料寫入公開 GitHub。
## 實作驗收
沿用既有 HQ 任務與審核機制；新增市場研究入口、結構化商機卡及篩選、證據/評分缺漏提示、轉提案與審核紀錄；記錄 skill_version/hash。以測試資料驗證，不冒充真實商機。排程、AI 搜尋、資料庫與前端需實測後才標記 live；本文件本身不代表已啟用自動執行。
