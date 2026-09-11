Pace & Page v7.1｜TEST BUILD
更新日期：2026-09-11

這是一個「獨立測試版」。請先部署到新的 GitHub Pages 測試網址，不要直接覆蓋目前正式網站。

━━━━━━━━━━━━━━━━━━━━
一、這版的定位
━━━━━━━━━━━━━━━━━━━━

Pace & Page = 後西醫備考 Planner + Focus + Study Records + Vocabulary + Insights。

v7.1 不使用 AI API，不需要 token 費用。
Review（課程複習）預設關閉；未啟用時不顯示複習欠帳，也不會把舊課追溯成大量 overdue。

視覺：
- 冷色藍灰 Study OS 基調
- 拼貼 / 手帳紙張 / 膠帶元素
- 辰宇落雁體（沈魚落雁風格）作 Display Font
- 密集資料維持乾淨 sans-serif
- 支援 Dark Mode

━━━━━━━━━━━━━━━━━━━━
二、v7.1 主要功能
━━━━━━━━━━━━━━━━━━━━

TODAY
- 今日 Focus 累計
- 各科今日時間
- Today Plan
- Next Best Action（規則式，不是 AI）
- Study Brief
- Today Timeline
- Quick move（Inbox / This Week → Today）
- Day Close

PLAN
- Study Inbox
- Today / Tomorrow / This Week / Next Week / 指定日期
- 任務新增 / 修改 / 刪除 / 移動
- List / Timeline 兩種顯示模式
- Daily Capacity
- 全日 / 半日讀書日快速容量模板
- Weekly Targets
- Plan vs Reality
- Weekly Note

FOCUS
- Quick Focus：先開始，結束後再分類
- Task Focus：從任務直接開始
- 25 / 45 / 50 / 60 / 90 / 自訂
- 圓形時鐘刻度 + 進度環
- Pause / Resume
- +10 / +15 min
- 可縮小為浮動 mini clock，繼續使用其他頁面
- 支援時會使用 Wake Lock
- 重新整理後可恢復仍在進行的 Focus
- 完成後直接寫入紀錄

RECORDS
- 補記今天 / 昨天 / 前天 / 指定日期
- 30 / 45 / 50 / 60 / 90 分鐘快速選擇
- 儲存 + 再新增
- History 搜尋 / 科目篩選
- QuickLog 紀錄可修改 / 刪除
- Calendar / ActivityLog 原始紀錄在連線且使用 v7.1 Apps Script PATCH 時可同步修改 / 刪除
- Undo（支援的操作會出現）

STUDY
- Courses：原始名稱自動清理成人類可讀格式
- Questions：題數、正確率、錯誤類型、修改 / 刪除
- Vocabulary：Quick Capture、Due / New / Learning / Mastered、1/3/7/14/30 間隔複習、修改 / 刪除
- Review：Optional Module，預設 OFF；開啟後只從啟用日開始排

INSIGHTS
- DAY / WEEK / MONTH / 90 DAYS
- Study time / 前一期比較
- Avg / day
- Questions + accuracy
- Focus sessions
- 科目水平條形圖（固定科目顏色）
- 活動類型分布
- 每日讀書時間
- Weekly Plan vs Actual
- Heatmap
- 點統計數字可看明細
- 規則式摘要先於圖表

快捷鍵
- N：新增
- F：Focus
- /：全站搜尋

━━━━━━━━━━━━━━━━━━━━
三、部署網站（測試版）
━━━━━━━━━━━━━━━━━━━━

建議建立新的 GitHub repository，例如：
pace-and-page-v7-1-test

把下列檔案放在 repository 根目錄：
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- icon-180.png
- icon-512.png

GitHub → Settings → Pages → Deploy from branch → main / root。

等 Pages 網址出現後，用 Safari / Chrome 打開。
手機可用 Safari → 分享 → 加入主畫面，作為 PWA 使用。

━━━━━━━━━━━━━━━━━━━━
四、Apps Script 更新（需要雲端寫入時）
━━━━━━━━━━━━━━━━━━━━

檔案：Pace_and_Page_v7_1_WebApp_PATCH.gs

1. 打開「後西醫 Study Database」→ 擴充功能 → Apps Script。
2. 保留你原本 Calendar → ActivityLog 的 syncStudyCalendar() 程式。
3. Apps Script 專案中只能有一組 doGet() / doPost()。
4. 用 Pace_and_Page_v7_1_WebApp_PATCH.gs 取代舊 Web App PATCH 的 doGet / doPost 版本。
5. Script Properties 的 STUDY_WEB_SECRET 使用你「目前正式版已在使用的同一組同步密鑰」。
   ※ 不要把密鑰寫進 GitHub / app.js / README。
6. 部署 → 管理部署 → 編輯 → 建立新版本 → 部署。
7. Pace & Page → More → Apps Script Web App URL / 同步密鑰 → 測試同步。

PATCH 會讀寫：
- ActivityLog
- ManualProgress
- QuickLog
- QuestionLog
- Vocabulary（首次需要時建立）
- WeeklyPlan（首次需要時建立）
- DecisionLog（首次需要時建立）
- PlanBoard（首次需要時建立）

PlanBoard 中「Today / Tomorrow / 指定日期」的日任務會同步到「後西醫｜PLAN」Calendar；Inbox / This Week / Next Week 不會硬塞進 Calendar。

━━━━━━━━━━━━━━━━━━━━
五、第一次測試建議
━━━━━━━━━━━━━━━━━━━━

請依序測：
1. More → 儲存 / 測試同步。
2. Today：確認今天原本 DONE 時數與 Calendar PLAN 有讀到。
3. Plan：建立一個 Inbox 任務 → 移到 Tomorrow → 再移到 Today。
4. Plan：切 List / Timeline，確認 Today / Tomorrow 顯示方式真的不同。
5. Focus：開 50 min → 縮小 → 到 Insights / Vocabulary → 再展開。
6. Focus：Pause → +10 → Finish → 填做了什麼 → 儲存。
7. Study → History：修改剛剛紀錄，再刪除一筆測試紀錄。
8. 補記：補昨天 45 min，確認週統計增加在正確日期。
9. Weekly Targets：設定各科目標，確認 Plan vs Actual 不再用零碎 Calendar PLAN 算出 467%。
10. Vocabulary：新增一個字 → Review → 不會 / 模糊 / 會。
11. More：確認 Review 預設 OFF。若要測試再開啟，確認只從當天開始。
12. 手機：確認 mini Focus clock 不會擋住底部導航。

━━━━━━━━━━━━━━━━━━━━
六、關於舊課程 Catalog
━━━━━━━━━━━━━━━━━━━━

v7.1 不會偽造或猜測未取得的課名。
目前 Courses 會完整讀取你真實的 ActivityLog / ManualProgress，並內建已能確定的物理 catalog 基線；因此「已出現在資料庫的課」會正常顯示與追蹤。

舊版網站中從未開始、且從未進入 ActivityLog / ManualProgress 的完整零狀態課程名稱，若尚未被帶入新版來源，可能暫時不會出現在 Courses 清單；總課程數仍保留既有基準（物理 105 / 生物 177 / 生化 129 / 化學 104）。

正式取代舊網站前，建議最後再做一次 Legacy Catalog 1:1 migration；不要用猜的課名補滿。

━━━━━━━━━━━━━━━━━━━━
七、正式替換原網站以前
━━━━━━━━━━━━━━━━━━━━

先至少測試：
- Mac 桌機
- iPhone Safari / 加入主畫面
- Focus 縮小與恢復
- Calendar PLAN / DONE 同步
- 修改 / 刪除 Calendar 原始紀錄
- 離線後重新連線
- Weekly Targets / Plan vs Actual

確認穩定後，再把正式 study-os repo 換成 Pace & Page v7.1。

目前版本：7.1.0 TEST
