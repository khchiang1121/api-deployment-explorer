# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 2026-02-08
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
