# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- **URL State Persistence**: Application state (View Mode, Region, Cluster, API) is now synchronized with URL query parameters, enabling deep linking and sharing.

### Changed
- **Persistence Mechanism**: Switched from `localStorage` to URL-based persistence for better shareability and user experience.
- **State Restoration**: improved initialization logic to robustly restore state from URL parameters relative to loaded configuration.

### Fixed
- **Race Condition**: Resolved an issue where initial URL parameters could be overwritten during asynchronous configuration loading.

### Changed
- **Configuration Schema Refactor**:
  - Removed `id`, `rawType` field from `Environment` schema in `config.json`.
  - Removed `displayName` field from `Environment` schema in `config.json`.
  - Updated `name` field to represent the short Cluster Name (e.g., "STG1" instead of "ENT-STG1").
- **Core Logic Updates**:
  - Implemented strictly random ID generation (`crypto.randomUUID`) for all environments on application load.
  - Decoupled internal logic from environment attributes (`Region`, `Name`).
  - Updated `resolveUrl` to remove attribute-dependent override key construction, strictly adhering to the "no attribute dependency" rule.
- **Documentation**:
  - Updated `docs/Configuration.md` to reflect the removed fields and new schema.
