Study OS v7｜測試版安裝與使用
================================

這一版的目的：
先建立獨立 v7 測試站，不覆蓋目前 Stable 正式版。
確認手機 / Mac 操作、資料同步與新功能都穩定後，再決定是否讓 v7 接管原正式網址。

一、這次已整合的功能
----------------------
1. Today 首頁重設
   - 今日 DONE 累積時間
   - PLAN / DONE execution
   - 各科今日投入
   - Today Plan
   - Study Brief（規則式，不使用 AI）
   - Next Best Action
   - Today Timeline

2. Focus（參考 YPT 的使用感）
   - Quick Focus：25 / 45 / 50 / 60 / 90 / 自訂
   - 可以「先開始 50 分鐘 → 結束後才填做了什麼」
   - Task Focus：從今日 PLAN / 課程直接進入
   - Pause / Resume
   - +10 / -5 min
   - 重新整理可恢復 Focus
   - 支援螢幕防熄（瀏覽器支援 Wake Lock 時）
   - 時間到可震動提示（裝置支援時）
   - 結束後直接寫 DONE，不需要再重複輸入一次

3. 歷史補記
   - 今天 / 昨天 / 前天 / 自訂日期
   - 科目、類型、內容、分鐘、理解度、備註
   - 正確計入該日、該週與 Insights
   - 30 / 45 / 50 / 60 / 90 分鐘快速選擇
   - 可「儲存＋再新增」連續補多筆
   - 使用現有 QuickLog + DONE Calendar 能力

4. Weekly Plan / Plan vs Reality
   - 週視圖
   - 各科每週目標時數
   - 實際 vs 目標
   - Weekly Review（規則式分析，不用 AI token）
   - Today 顯示考試 D-Day / 目前備考階段

5. Study Workspace
   - Courses：支援 027,028,029 或 27-30 批次補進度
   - Review Queue
   - Questions
   - Vocabulary

6. Vocabulary
   - Quick Capture：先輸入單字即可
   - Meaning / Source / Sentence 可後補
   - New / Weak / Due / Mastered
   - 1 / 3 / 7 / 14 / 30 day interval
   - 不會 / 模糊 / 會 三鍵複習

7. Insights
   - DAY / WEEK / MONTH / 90 DAYS
   - 學習時間
   - Subject Breakdown
   - Activity Breakdown
   - Focus 統計
   - Study Heatmap
   - Streak
   - Progress Insight

8. UI / UX
   - 手機底部 5 個主導覽：Today / Plan / Study / Insights / More
   - 浮動 + Quick Add
   - Bottom Sheet 表單
   - Light / Dark Mode
   - 辰宇落雁體作品牌與 Display Font
   - 正文仍使用高可讀系統字體
   - Keyboard：N 新增、F Focus、/ 搜尋課程
   - 今日 PLAN 的 ✓ 可直接一鍵完成並寫入 DONE

9. Decision Log
   - 記重大備考決策與原因
   - 可設定回看日期

10. 不使用生成式 AI
   - 沒有 AI Chat
   - 沒有自然語言操作
   - 不需要 AI API / token / 額外 AI 費用


二、先開 v7 測試站（建議方式）
-------------------------------
不要先覆蓋你目前正式 study-os repository。

建議在 GitHub 新增一個 repository，例如：
study-os-v7-test

把這個資料夾中的：
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- icon-180.png
- icon-512.png

全部放到 repository 根目錄。

GitHub Pages：
Settings → Pages → Deploy from a branch → main / root

之後會得到一個獨立 v7 URL。
Mac / iPhone / iPad 都可以直接開。
iPhone Safari → 分享 → 加入主畫面，就會像 App 一樣開啟。


三、Apps Script 更新（要跨裝置同步 v7 新資料時才做）
-----------------------------------------------------
你目前 Stable 版已經有：
- Calendar → ActivityLog
- ManualProgress
- QuickLog
- QuestionLog
- Web DONE → QuickLog + 後西醫｜DONE Calendar

這些架構繼續保留。

重要：保留原本 syncStudyCalendar() 與它的 Trigger。

更新方式：
1. Google Sheet「後西醫 Study Database」→ 擴充功能 → Apps Script。
2. 保留 syncStudyCalendar() 那份程式。
3. 找目前 Study OS Web App PATCH（含 doGet / doPost）的 .gs。
4. 用 Study_OS_v7_WebApp_PATCH.gs 取代「Web App PATCH」。
5. 確認整個 Apps Script 專案只有一組 doGet() / doPost()。

【新增安全設定】
新版不把同步密鑰直接硬寫在 .gs 檔。

Apps Script 左側 / 專案設定 → 指令碼屬性（Script properties）新增：
Property：STUDY_WEB_SECRET
Value：填你目前 Stable Study OS 已經在使用的「同一組同步密鑰」。

不要把這組密鑰放進 GitHub。

6. 儲存。
7. 部署 → 管理部署 → 目前 Web App → 編輯 → 新版本 → 部署。
8. 若使用原本 deployment，/exec URL 可以維持不變。

v7 第一次同步時會自動建立：
- Vocabulary
- WeeklyPlan
- DecisionLog
（第一次有資料寫入時建立）

Calendar 使用既有名稱：
- 後西醫｜DONE
- 後西醫｜PLAN
不需要把 Calendar ID 寫進公開程式碼。


四、v7 網站設定
----------------
v7 → More：
- Apps Script Web App URL：貼現有 /exec URL
- 同步密鑰：貼你現有密鑰
- 考試日期：自行設定
- 每週目標時數：自行設定

按「儲存設定」→「測試同步」。

同步密鑰只存在瀏覽器 localStorage / settings，不寫在 GitHub 原始碼。


五、目前 v7 測試版特別說明
---------------------------
A. 舊課程完整 catalog
v7 不會假造舊課程名稱。
Courses 頁會優先使用 ManualProgress + 真實 ActivityLog 中已出現的課程。
你目前舊版 index.html 內建的完整 105 / 177 / 129 / 104 課程 catalog，之後若要 1:1 搬入 v7，建議以舊版 catalog JSON 再做一次 migration；不要用自動產生的假課名取代。

B. PLAN
現有 iPhone Shortcut / Google Calendar PLAN 繼續完全相容。
v7 新增 PLAN 時，如果 Apps Script 已設定成功，會直接寫入既有「後西醫｜PLAN」Calendar；如果尚未設定同步，會先保存在 v7 本機。
測試時建議先建立 1 筆 5 分鐘測試 PLAN，確認 Calendar 與 ActivityLog 回流正常。

C. 離線
網站本身有 PWA cache。
新增 DONE / PLAN / 刷題 / 課程進度若當下無法寫回 Apps Script，會先保留在本機，並加入『待同步』佇列；下次同步時會自動重送。More → About v7 可看到待同步筆數。
重要紀錄仍建議在網路恢復後按一次『同步』確認。

D. 辰宇落雁體
網站使用官方 GitHub 的辰宇落雁體 2.0 作為 display font，正文不使用手寫體，以維持長時間閱讀舒適度。
若外部字型暫時無法載入，會自動 fallback 到系統字體，不影響功能。


六、建議驗收清單
----------------
1. Mac 打開 v7，五個主頁都能切換。
2. iPhone 打開 v7，底部導航 + 浮動「＋」好不好按。
3. 開 1 分鐘 Focus → 結束 → 填物理 / 測試 → 儲存。
4. Google Sheet QuickLog 有資料。
5. Google Calendar「後西醫｜DONE」有事件。
6. 補記「昨天」30 分鐘 → Insights WEEK 是否正確增加。
7. Vocabulary 新增 3 個單字 → Review 是否可翻卡與評級。
8. Weekly Targets 設定各科時數 → Plan vs Reality 是否直覺。
9. Dark Mode 是否舒適。
10. 手機「加入主畫面」後重新開啟，Focus / 設定是否保留。

等以上都 OK，再把 v7 移到正式 study-os repository。


七、v7.0.1 這次額外 UX 強化
-----------------------------
- Quick Focus：可以先開 50 分鐘，完成才分類內容。
- PLAN 任務 ✓：一鍵完成，不再先開另一個表單。
- 歷史補記：日期快速選擇 + 分鐘 preset + 連續新增。
- Focus：支援 Wake Lock 防熄屏（裝置/瀏覽器支援時）。
- 離線：失敗寫入會排入 pending queue，之後自動重送。
- 課程進度：支援批次代碼。
- Today：設定考試日期後會顯示 D-Day 與目前備考階段。

這一版仍是『獨立測試版』，不建議在手機/桌機驗收前直接覆蓋原 Stable 正式站。
