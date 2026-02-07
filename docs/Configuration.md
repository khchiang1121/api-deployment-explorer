# 配置指南 (Configuration Guide)

本文件詳細說明 `public/config.json` 的結構與配置方式，協助您管理 API 部署、環境與路由規則。

## 1. 檔案結構 (Structure)

設定檔主要包含兩個核心陣列：
- `envs`: 定義所有部署環境 (Environments)
- `apis`: 定義所有微服務與 API (Services)

```json
{
  "envs": [ ... ],
  "apis": [ ... ]
}
```

---

## 2. 環境配置 (Environments)

`envs` 陣列定義了應用程式支援的部署環境。

### 欄位說明

| 欄位 | 類型 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 唯一識別碼 | `"F20-PRD1"` |
| `region` | `string` | 所屬區域 (Region) | `"F20"`, `"Global"` |
| `name` | `string` | 識別名稱 (通常等於 ID) | `"F20-PRD1"` |
| `displayName` | `string` | 顯示名稱 (UI 顯示用) | `"PRD1"` |
| `type` | `string` | 環境類型 (分組用) | `"PRD"`, `"STG"`, `"QA"` |
| `urlPattern` | `string` | **預設 URL 模式**。<br>支援變數：`{api}`, `{region}`, `{type}` | `"https://{api}.app.{type}.{region}.com"` |
| `regionalUrlPattern` | `string` | **區域性 URL 模式** (選填)。<br>當 API scope 為 `REGION` 時使用。 | `"https://{api}.app.{region}.com"` |

### 全域環境 (Global Environments)

若要設定全域環境，請將 `region` 設為 `"Global"`。這通常配合 `GLOBAL` scope 的 API 使用。

```json
{
  "id": "Global-PRD",
  "region": "Global",
  "type": "PRD",
  "urlPattern": "https://{api}.global.prd.com"
  ...
}
```

---

## 3. 服務配置 (APIs)

`apis` 陣列定義了系統中的微服務及其端點。

### 欄位說明

| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |

| `name` | `string` | 服務名稱 |
| `category` | `string` | 分類 (UI 分組用) |
| `description` | `string` | 簡短描述 |
| `scope` | `string` | **作用域**。<br>- `CLUSTER`: 預設，每個 Cluster 都有獨立實例。<br>- `REGION`: 區域共用實例 (使用 `regionalUrlPattern`)。<br>- `GLOBAL`: 全域單一實例 (僅顯示在 "全域服務" 分頁)。 |
| `urlKey` | `string` | URL 變數 `{api}` 的替換值 |
| `endpoints` | `object[]` | API 端點列表 (Method, Path, Label) |
| `deployRules` | `object` | **部署規則** (詳見下節) |

### 作用域 (Scope)

- **CLUSTER** (預設): URL 解析使用 `env.urlPattern`。
- **REGION**: URL 解析使用 `env.regionalUrlPattern`。適用於每個 Region 只有一套的服務 (如 Registry, Vault)。
- **GLOBAL**: URL 解析使用 `env.urlPattern` (通常配合 Global Region)。**僅顯示於全域服務分頁**。

---

## 4. 部署規則 (Deploy Rules)

使用 `deployRules` 來控制 API 僅在特定環境或區域顯示。

| 規則 | 類型 | 說明 |
| :--- | :--- | :--- |
| `onlyRegions` | `string[]` | **白名單**：僅在指定區域顯示。 |
| `onlyTypes` | `string[]` | **白名單**：僅在指定環境類型顯示 (如只在 `PRD` 部署)。 |
| `excludeRegions` | `string[]` | **黑名單**：排除指定區域。 |
| `excludeTypes` | `string[]` | **黑名單**：排除指定環境類型。 |

### 範例

**僅部署在生產環境 (PRD)**:
```json
"deployRules": {
  "onlyTypes": ["PRD"]
}
```

**排除特定區域 (F14)**:
```json
"deployRules": {
  "excludeRegions": ["F14"]
}
```

---

## 5. URL 覆寫 (Overrides)

若特定環境的 URL 不符合通用的 Pattern，可使用 `urlOverrides` 直接指定完整 URL。

```json
"urlOverrides": {
  "F20-PRD1": "https://custom-url.internal.com/api"
}
```

---

## 6. URL 變數參考

在 `urlPattern` 中可使用的變數：

- `{api}`: 對應 API 的 `urlKey`。
- `{region}`: 對應 Environment 的 `region`。
- `{type}`: 對應 Environment 的 `type` (如 `PRD`)。
- `{rawType}`: 對應 Environment 的 `rawType` (如 `PRD1`)。
