[] 全選搜尋的功能有問題, 當搜尋出結果後, 點擊全選, 應該要全選搜尋結果, 但現在是全選所有項目
[] 現在的設計中, 一個環境(例如PRD1)會同時屬於多個 Region(例如Region-01, Region-02), 但是實際上, 一個環境就等於一套 k8s cluster, 所以儘管名稱相同, 但他們實際上是不同的 k8s cluster, 需要重新設計
    舉例來說, Region-01-PRD1 和 Region-02-PRD1 雖然都是 PRD1, 但實際上是不同的 k8s cluster, 需要重新設計以支援此方式, 包含 config 結構、filter 邏輯
[] 需要新增 Regional apis, 某些 api 是整個 region 只有一個, 某些 api 是每個 cluster 都有. 對於 regional apis, 我們可以在 region 頁面顯示, 或是在每個 cluster 頁面顯示但是特別標示他是 regional api