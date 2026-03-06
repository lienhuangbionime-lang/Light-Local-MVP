# 2026-03-05 Cloud Connectivity & Architectural Fixes

## Problem
The cloud version of Cortex AI was inaccessible, throwing "Connection lost" errors.

## Causes
1. **Strict CORS**: The backend only allowed a specific Vercel production URL, blocking preview and other cloud instances.
2. **Hardcoded Fallback**: The frontend proxy had a hardcoded fallback to an old Render URL if environment variables were missing.
3. **Database Client State Mutation**: A logic bug in `get_request_client` mutated the global `supabase` singleton with `_is_guest_mode = True`, breaking subsequent requests and background tasks.

## Fixes
- **Dynamic CORS**: Backend now reads `ALLOWED_ORIGINS` from environment variables.
- **Resilient Proxy**: Frontend proxy now strips trailing slashes from `BACKEND_URL` and logs warnings if the env var is missing.
- **Safe Client Wrapping**: Used a wrapper for request-scoped database clients to prevent global state pollution.

## Impact
Improved stability and deployment flexibility for the LifeOS Cloud instance.
