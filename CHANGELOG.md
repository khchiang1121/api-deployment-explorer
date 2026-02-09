# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### [Unreleased]
#### Added
- **Gen1/Gen2 Cluster Labels**:
  - Added `clusterType` field to `config.json` to distinguish between Generation 1 and Generation 2 clusters.
  - Implemented logic to display cluster type badges in Environment Header and API Panorama views.
  - Styled badges with distinct colors (Teal for Gen2, Slate for Gen1).
- **API Deployment Rules**:
  - Added `onlyClusterTypes` support to `deployRules` in `config.json`.
  - APIs can now be restricted to specific cluster generations (e.g., `["Gen2"]`) or allowed in both (`["Gen1", "Gen2"]`).
  - Updated "Docker Registry" configuration to explicitly allow both Gen1 and Gen2 as a verification case.

#### Fixed
- **Configuration**: Removed duplicate `displayName` fields in `config.json` to ensure valid JSON format.
- **Global Services**:
  - Widened the Global Services view layout to utilize more screen space (`max-w-[1600px]`).
  - Added full URL display under environment labels in Global Services cards.
  - Fixed search functionality in Global Services view to correctly filter both the Sidebar list and Main Content.
- **UI Improvements**:
  - Changed "Gen2" cluster label color from Teal to **Blue** to improve contrast against "Dev" (Emerald) and "QA" (Amber) labels.
- **Health Check**:
  - Added visual health indicators (Green/Red dots) before the URL in Environment View.
  - Implemented `ENABLE_HEALTH_CHECK` toggle (default: `true`).
  - Fixed Environment ID generation to be stable (`${region}-${name}`), enabling correct `urlOverrides` in `config.json`.
- **Development**:
  - Added `public/config.dev.json` with realistic test data (US/EU regions, Payment Gateway, GenAI).
  - Updated `App.tsx` to load `config.dev.json` by default for development.



#### Added
- **Dark Mode**:
  - Implemented full system-aware Dark Mode with a neutral Gray palette.
  - Added theme persistence via `localStorage`.
  - Fixed UI inconsistencies in Header and API Matrix views.
- **URL State Persistence**:
  - Synchronized application state (View, Region, Cluster, API) with URL query parameters for deep linking.
- **Global Services Enhancements**:
  - Optmized Global Settings view with a one-click dense grid layout.
- **Configuration**:
  - Implemented automatic random ID generation for environments (`crypto.randomUUID`).

#### Changed
- **Refactor**:
  - Simplified configuration schema by removing manual IDs (`70bb252`, `0ace77e`).
  - Decoupled internal logic from specific Environment attributes.
  - Removed unused configuration files (`d43de58`).

### 2026-02-07
#### Added
- **Global Services Support**: Added initial support for Global Services view (`ef3bbe2`).
- **Response Handling**: Implemented continue response functionality (`4f432dd`).

### 2026-02-03
#### Added
- **Project Initialization**:
  - Initial commit of ServiceDeck (renamed to `api-deployment-explorer`).
  - Added CI configuration.
- **Features**:
  - Implemented initial layout and Regional API filtering.
  - Added support for loading configuration from external `config.json` (`c823492`).

#### Changed
- **Documentation**: Updated README with dashboard screenshots.
- **Refactor**: Renamed project to `api-deployment-explorer`.
