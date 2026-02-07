# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
