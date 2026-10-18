# HANA Visual Library｜素材庫連接規格

Google Drive root folder: https://drive.google.com/drive/folders/1rNILiVMDryuawTEJOgGiYYM7r_9bhb6H

## Folder map
- Inbox 00 待整理上傳: 1IiWS9R-EUmpZ7WWh1JQc_e6EdbSMGBFo
- 01 植物與香材: 13lK6i8yYiNPONVul2m_exKJlplrHnEN_
- 02 藝術與文化: 16LXPqSIglhNoqXcaUirV6ALGNo0Y86rW
- 03 空間與建築: 12FHtNxTYUhF22q1QzDTJBKgAf0-IX5ul
- 04 物件與材質: 1oqlJBPMYc59eYI4QxrjmWA7fB0lPk97L
- 05 光影與抽象: 1Ei4UkU0MGX-wX12jGmtXX70l2q7bldgy
- 06 HANA 原創: 12fvhbUUX0zE5LDqZvLJhYAylC8A32jov

## Social Editor integration contract
Every uploaded photo remains in Drive. An index should store Drive file ID, thumbnail, category, object name, keywords, capture date, rights/consent, alt text, scientific name only if verified, source, status, and reuse history.
Social Editor should query approved original imagery first, then licensed external material. Do not copy files to GitHub unless explicitly necessary and permitted.
Unreviewed inbox files must never be auto-published. Human approval remains mandatory.

## Deployment status
Drive folders: created.
Automatic folder watcher, metadata extraction, searchable index, Canva asset import and image matching: NOT YET IMPLEMENTED. Requires Drive event/polling authorization, persistent storage and review interface.
