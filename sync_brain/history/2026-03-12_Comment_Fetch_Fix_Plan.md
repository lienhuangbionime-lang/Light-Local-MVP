# Updated Implementation Plan - Fix Comment Fetching & Parsing

Based on a thorough review of the last 3 days of development history and the current codebase, I have identified critical blockers preventing real Facebook comments from being processed.

## User Actions Required (CRITICAL)

> [!IMPORTANT]
> **Missing Permissions**: The Meta App is missing the `pages_read_user_content` permission. Without this, the system cannot see the text of comments from regular fans.
> 1. Go to the Meta App Dashboard -> App Settings -> Permissions.
> 2. Add **`pages_read_user_content`**.
>
> **App Mode**: Ensure the Meta App is in **"Live"** mode. "Development" mode only works for owners/admins.

## Proposed Changes

### Backend Component

#### [MODIFY] [main.py](file:///C:/Users/lien.huang/AppData/Local-First%20MVP/backend/main.py)
- **Robust Persistence**: Update `load_orders` to always initialize `ACTIVE_PRODUCTS` and handle schema migration gracefully.
- **Improved Logging/Diagnostic**:
    - Update `process_webhook_data` to log *why* a comment was ignored (e.g., "Code X not in dictionary").
    - Store these rejection reasons in `LAST_EVENTS` so the frontend "Diagnostic Console" can show them.
- **Regex Update**: Make `parse_comment` more flexible to handle variations like "A + 1", "想要 A + 1", etc.

#### [MODIFY] [simulate_fb.py](file:///C:/Users/lien.huang/AppData/Local-First%20MVP/backend/simulate_fb.py)
- **Structure Realism**: Align the simulation payload exactly with the nested structure used by real Facebook Webhooks (`entry` -> `changes` -> `value` -> `message`).

### Frontend Component

#### [MODIFY] [DiagnosticConsole.tsx](file:///C:/Users/lien.huang/AppData/Local-First%20MVP/components/live/DiagnosticConsole.tsx)
- **Enhanced Rejection Display**: Visually flag events that were "Detected but Rejected" due to missing mappings, prompting the user to click "Sync to Cloud".

## Verification Plan

1. **Verify Mapping Persistence**:
   - Add a mapping in Frontend -> Sync to Cloud.
   - Restart Backend.
   - Verify `/api/seller/stats` still shows the mapping.
2. **Verify Simulation**:
   - Run updated `simulate_fb.py`.
   - Verify `DiagnosticConsole` shows the event and the backend creates an order.
3. **Real Comment Check (Meta)**:
   - After adding `pages_read_user_content`, have a non-admin user comment on the page.
   - Verify it appears in `DiagnosticConsole`.
