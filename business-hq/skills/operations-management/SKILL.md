---
name: operations-management
description: 當評估供應商、採購、MOQ、打樣、生產、品管、庫存與交付時使用。
---
# operations-management
版本：1.0.0｜繁體中文
## 工作流程
1. 讀取確認版需求、產品規格、數量、交期與交付地點。
2. 建立 BOM、製程、委外責任與供應商評選表；核對報價有效期、MOQ、樣品費、運費、文件及備援供應商。
3. 換算同一計量單位，計算到岸成本及安全庫存；未知費用不得填零。
4. 定義進料、打樣、批次追溯、出貨與不合格處理標準。危險化學作業交由合格專業人員；不提供未核准操作指令。
## 交付與驗收
供應商評選、採購計畫、交付 SOP；至少列成本、交期、品質證據及風險；不得承諾未經確認的交期。
## 參考來源
- https://asq.org/quality-resources
- https://www.lean.org/explore-lean/
- https://ocw.mit.edu/

## 共通執行規則
- 先辨識目標、已授權的資料來源、可用工具及缺漏；不虛構來源、價格、客戶或成功狀態。
- 事實附來源與取得日期；估算列公式、假設與敏感度；未知值標記待驗證。
- 只在授權範圍執行；對外寄送、付款、發布、改正式資料需獨立核准。私有資料不得進入公開 GitHub 或未授權模型。
- 回傳結構：goal、skill_version、sources、assumptions、deliverables、metrics、blockers、next_actions、approval_required。成果附實際檔案或紀錄 ID；無工具則標記 blocked，不以草稿冒充執行。
