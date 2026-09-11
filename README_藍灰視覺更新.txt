Study OS v7｜Blue-Gray Visual Update

這一版只調整視覺品牌，不改動既有資料與功能邏輯。

視覺方向：
- 回到上一版 Study OS 的冷色藍灰基調
- 背景改為冷灰白，不再使用米白／灰綠
- Focus、Active navigation、Study Brief、進度圖表統一使用低飽和 slate blue
- Dark Mode 改為深藍灰／navy
- 保留 v7 的大圓角、留白、Today/Focus 資訊層級與手機 UX
- 沈魚落雁／辰宇落雁體繼續作為 Display font 使用

部署測試：
1. 先在 v7 測試 repo 覆蓋 index.html / styles.css / app.js / manifest.webmanifest / sw.js / icon 檔案。
2. Commit + Push。
3. GitHub Pages 更新後，建議強制重新整理一次。
4. 若已加入主畫面且仍看到舊配色，完全關閉 PWA 後重開；本版已更新 service-worker cache key。
