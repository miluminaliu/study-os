Page & Pace v7 · build01
========================
這一版是「可操作的第一版 preview build」，目標是先把我們討論好的使用流程與視覺真正做出來，
同時盡量沿用你原本 Study OS 的 Calendar / Google Sheet / Apps Script 架構。

這版已包含
---------
1. 品牌改為 Page & Pace / study journal。
2. Today：今日 PLAN / DONE、Next Action、漏記檢查、Today’s Words。
3. Focus Timer：50/10、25/5、75/15、Lecture stopwatch；Pause / Resume / Finish & Log；重整後可恢復。
4. Week：七日週誌、Plan vs Reality、各科投入。
5. Study：物理 / 生化 / 生物 / 化學 / English Hub。
6. English Reading：整合 Vol.01–Vol.06，共 50 篇、337 題；依各篇實際題數記分，可記分鐘與錯題技能。Vol.05–06 已預載詳解本 High-Yield Vocabulary 聯動。
7. Vocabulary：已匯入你提供的 3331 筆後醫 Core Bank；Due + New；忘記 / 模糊 / 熟悉 / 已會；裝置 speechSynthesis 發音。
8. Review：單字到期、近期可能漏記、QuestionLog 待回看。
9. Archive：本月摘要、最近紀錄、同步設定、JSON 備份。
10. 無 AI API、無 token 成本。
11. PWA / Service Worker，可繼續走 GitHub Pages。

重要：這版先不要直接覆蓋目前正式站
----------------------------------
建議先把整個資料夾放到 GitHub repository 的 /preview-v7/ 子資料夾，
讓網址變成類似：
  https://你的帳號.github.io/study-os/preview-v7/

先用 iPad / iPhone 實際操作 1–2 天，確認 UX 與視覺後，再把 v7 併到正式根目錄。
這樣不會因為 UI 重製而影響你現在能用的穩定版。

A. 前端 Preview
-------------
1. 把本資料夾內的檔案放到 study-os/preview-v7/。
2. 不要把你舊站的檔案刪掉。
3. GitHub Desktop → Commit → Push。
4. 等 GitHub Pages 更新後開 preview-v7/。
5. Page & Pace → Archive → Sync：
   - Web App URL：貼你目前 Apps Script 的 /exec URL
   - 同步密鑰：貼你原本那組密鑰
6. 先按 save & test。

即使你還沒更新 Apps Script，舊有 ActivityLog / ManualProgress / QuickLog / QuestionLog 的讀取與 Focus DONE
仍可先測；ReadingProgress / VocabProgress 要跨裝置同步，才需要做 B。

B. Apps Script（讓閱讀與單字也跨裝置）
--------------------------------------
重要：保留你原本 Calendar → ActivityLog 的 syncStudyCalendar() 與 Trigger。

1. Google Sheet「後西醫 Study Database」→ 擴充功能 → Apps Script。
2. 找目前負責 Web App 的 patch。
3. 備份舊檔。
4. 用 Page_Pace_WebApp_PATCH.gs 取代舊 Web App patch 的 doGet/doPost。
5. 把：
   PASTE_YOUR_EXISTING_SYNC_SECRET_HERE
   換成「你現在正在用的同一組同步密鑰」。
6. 不要把同步密鑰貼到 GitHub 前端檔案。
7. 確認專案只剩一組 doGet() / doPost()。
8. 可先手動執行 setupPagePaceSheets()；它會新增：
   - ReadingProgress
   - VocabProgress
   不會刪除舊分頁。
9. 部署 → 管理部署 → 現有網頁應用程式 → 編輯 → 新版本 → 部署。
10. 用「管理部署 → 新版本」時，原本 /exec URL 通常可維持不變。

原有分頁會繼續使用：
- ActivityLog
- ManualProgress
- QuickLog
- QuestionLog

新增：
- ReadingProgress
- VocabProgress

C. 字體
------
為了避免把你的字體檔重新打包／散佈，ZIP 不附字體本體。
你可以把自己擁有授權的字體手動放到：
  assets/fonts/

目前 styles.css 預設尋找：
- AaXiuKai.ttf
- 辰宇落雁体.ttf

沒有放字體也能正常使用，只會改用系統 fallback。

D. 資料遷移
-----------
Page & Pace 會嘗試沿用舊版瀏覽器的 studyActivities 快取；真正的主資料仍以雲端同步為準。
這版不會修改或刪除你的 ActivityLog 舊資料。

E. 目前 build01 刻意沒有做的事
----------------------------
- 沒有生成 AI 聊天／自然語言操作。
- 沒有把題本全文塞進網站，只追蹤閱讀 metadata、成績與錯題技能；Vol.01–04 的 High-Yield Vocabulary 尚未逐篇回填，Vol.05–06 已有聯動。
- 尚未把舊版「完整 500+ 課程 catalog」重新包進這個 preview；Study 頁目前先以實際同步紀錄與 ManualProgress 呈現。
  正式取代穩定版前，建議再把你「目前正在用的最新正式網站 ZIP」給我，我會做一次完整功能 parity merge，避免任何舊功能倒退。

F. 建議測試清單
-------------
1. Today 是否正確顯示今天 PLAN。
2. 從 PLAN 點 start focus → pause → resume → finish & log。
3. QuickLog 與「後西醫｜DONE」Calendar 是否出現紀錄。
4. 重整頁面後，正在跑的 timer 是否仍正確。
5. English → Reading → 隨便記一篇成績，再換裝置同步確認。
6. Vocabulary → today’s set → 背 3–5 個字，換裝置同步確認 due 狀態。
7. Day Close 是否能找到有 PLAN、沒有 DONE 的項目。
8. iPhone Safari → 加到主畫面，確認 PWA 可開。

版本：Page & Pace v7 build01 · 2026-09-11
