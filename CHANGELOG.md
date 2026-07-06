# Changelog

## 2026-07-05 - Equipment Upgrades Update

### Added

- Fleet Requisition Points (RP): earned for reporting anomalies to Fleet (+3), cataloguing new species (+1), and classifying new biomes (+1).
- New Equipment tab: spend RP to requisition Mk II equipment from Fleet.
- Six Mk II upgrades: survey drone battery (radius 3 → 5), LIDAR long-range optics (radius 2 → 4), star tracker adaptive optics (holds lock through weather), radio digital noise filter, spectrometer high-gain detector (resolves trace elements below 5%), and suit mobility servos (surface moves take half the time).
- RP balance in the top HUD; the Equipment tab pulses when an upgrade is affordable.
- Glossary entries for RP and equipment marks.

### Changed

- Save data now carries expedition-wide `equipment` and `requisition` fields; older saves migrate safely with a Mk I loadout and 0 RP.

## 2026-06-20 - Anomaly Discovery Update

### Added

- Anomaly site generation for each planet.
- Evidence-based anomaly confirmation across multiple instruments.
- New Anomalies tab with suspected, confirmed, and reported states.
- Pulsing Anomalies tab signal when an unresolved anomaly is nearby or a confirmed anomaly is ready to report.
- Confirmed anomaly map markers.
- Fleet anomaly reports with type-specific acknowledgement text.
- Glossary tab for anomaly IDs, instruments, HUD labels, and map symbols.
- Planet name and sky phase in the top HUD.
- Star tracker obstruction rules for daylight and rare poor-sky conditions.

### Changed

- Moved New Expedition seed controls to the system map.
- Replaced "Copy Last Reading" with "Save Reading" to directly log instrument readings.
- Improved save migration so older saves receive anomaly fields safely.

### Packaging

- Added GitHub-ready project documentation.
- Added GitHub Pages workflow for static deployment.
