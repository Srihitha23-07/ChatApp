# ChatApp v2 — Bug Report & Fix Summary

## Overview
Full audit of `chatapp-v2` (Spring Boot backend + React frontend).
**15 bugs found and fixed** in `ChatApp.jsx` (frontend).
Backend code is largely sound — notes below where relevant.

---

## FRONTEND BUGS (ChatApp.jsx)

### BUG #1 — WebSocket endpoint variable unused
**File:** `ChatApp.jsx`
**Severity:** Medium
**Description:** `const WS = "http://localhost:8080/chat"` was declared at the top
but never used — `SockJS` was being called with a string literal inline,
making the constant dead code and easy to desync.
**Fix:** Renamed to `WS_ENDPOINT` and used it consistently in the SockJS constructor.

---

### BUG #2 — Missing null guards on login response fields
**File:** `ChatApp.jsx` → `LoginPage.handleSubmit`
**Severity:** High (crash risk)
**Description:** `data.avatarColor` and `data.about` were passed directly to
`onLogin()` without defaults. For accounts created before these fields existed
in the DB, both would be `undefined`, causing downstream crashes when components
called `.toUpperCase()` or tried to render the color string.
**Fix:** Added `|| "#00d4aa"` and `|| ""` fallbacks.

---

### BUG #3 — Signup navigates to chat with incomplete user object
**File:** `ChatApp.jsx` → `SignupPage.handleSubmit`
**Severity:** High (crash risk)
**Description:** After registration, the backend `/auth/register` response
did not include `avatarColor`. The frontend called `onSignup({ username, id })`
without colour, then `ChatPage` tried to render the avatar with an `undefined`
colour string — resulting in a broken style like `background: undefined33`.
**Fix:** Added `avatarColor: data.avatarColor || "#00d4aa"` and `about: ""` defaults.

---

### BUG #4 — Password change: empty current-password allowed
**File:** `ChatApp.jsx` → `ProfileModal.changePassword`
**Severity:** Medium
**Description:** The change-password form let users submit with a blank
"Current Password" field. The backend would reject it but the frontend showed
no local validation, creating a confusing UX and an unnecessary round-trip.
**Fix:** Added an explicit guard before any network call.

---

### BUG #5 — Context menu renders off-screen at viewport edges
**File:** `ChatApp.jsx` → `ContextMenu`
**Severity:** Low/UX
**Description:** Right-clicking a message near the bottom-right corner of the
window positioned the context menu outside the visible area. The menu was
unreadable and unclickable.
**Fix:** Computed clamped `x`/`y` values using `window.innerWidth` / `window.innerHeight`
minus the menu dimensions before applying them to `style.top/left`.

---

### BUG #6 — `activeUserRef` had a one-render lag
**File:** `ChatApp.jsx` → `ChatPage`
**Severity:** Medium
**Description:** The original code used `useEffect` to sync `activeUserRef.current`
after each render: `useEffect(() => { activeUserRef.current = activeUser; }, [activeUser])`.
React's effect runs *after* paint, so on the very first render after a user
was selected, WebSocket handlers read the stale `null` from the ref.
**Fix:** Assign the ref synchronously during render:
`activeUserRef.current = activeUser;` — this is the canonical React pattern for
"latest value" refs.

---

### BUG #7 — Switching conversations did not reset typing indicator
**File:** `ChatApp.jsx` → `selectUser`
**Severity:** Medium/UX
**Description:** If user A was typing while you were in their conversation,
then you switched to user B, the "A is typing…" indicator persisted because
`typingUsers` state was never cleared.
**Fix:** Added `setTypingUsers({})` at the start of `selectUser`.

---

### BUG #8 — `stompRef` assigned before connect callback (race condition)
**File:** `ChatApp.jsx` → WebSocket `useEffect`
**Severity:** High
**Description:** The original code did:
```js
stompRef.current = client; // ← before connect
client.connect({}, () => {
  stompRef.current = client; // ← again inside callback
  ...
});
```
Between these two assignments, `stompRef.current` pointed to a not-yet-connected
client. Any code that checked `stompRef.current?.connected` in that window would
see `false` but still have a reference — and could call `.send()` on an
unconnected socket, silently dropping messages.
**Fix:** Assign `stompRef.current = client` only inside the success callback.

---

### BUG #9 — Own message echo from server was silently dropped (duplicate/lost IDs)
**File:** `ChatApp.jsx` → WebSocket message handler
**Severity:** High (data integrity)
**Description:** After sending a message, the frontend added an optimistic message
with a numeric `tempId = Date.now()`. When the server echoed the same message back
(now with a real MongoDB `_id`), the original code did:
```js
if (incoming.sender === currentUser.username) return prev; // own echo, already shown
```
This meant the optimistic message kept its fake numeric ID forever. Edit/delete
operations used the real server ID — so they never matched the temp entry,
leaving "ghost" messages that couldn't be edited or deleted.
**Fix:** When an own-echo arrives, look for a temp message with matching
`sender + receiver + content` and replace it with the real server object.

---

### BUG #10 — Edit was fire-and-forget with no optimistic update
**File:** `ChatApp.jsx` → `sendMessage` (edit branch)
**Severity:** Medium/UX
**Description:** The edit path called `fetch(...)` and cleared state immediately
but never updated the messages array optimistically. Users saw the old content
until the WebSocket broadcast arrived (could be 200-500ms), making the app
feel sluggish. Also, if the network call failed there was no rollback — the UI
showed the old content but state was already wiped.
**Fix:** Applied optimistic update first, then rolled back on network error.

---

### BUG #11 — Fake delivery/read simulation ran even with live WebSocket
**File:** `ChatApp.jsx` → `sendMessage`
**Severity:** Medium
**Description:**
```js
setTimeout(() => setMessages(... status:"delivered" ...), 900);
setTimeout(() => setMessages(... status:"read"      ...), 2800);
```
These timers always fired, even when the WebSocket was connected and the server
was broadcasting real status updates. This caused tick icons to jump: a message
would briefly show ✓✓ (faked "read") before snapping back when the real
"delivered" came in from the server — or it would show "read" ticks before the
recipient had even received the message.
**Fix:** Simulation only runs when WebSocket is disconnected (offline fallback).

---

### BUG #12 — Delete relied solely on WebSocket broadcast for UI update
**File:** `ChatApp.jsx` → `deleteMessage`
**Severity:** Medium/UX
**Description:** The delete function called `fetch(DELETE ...)` but the message
in the UI only changed when the broadcast arrived through WebSocket. On a slow
connection, messages appeared stuck for up to a second after clicking delete.
**Fix:** Applied optimistic update (`setMessages`) before the network call.

---

### BUG #13 — Typing timer leaked on logout
**File:** `ChatApp.jsx` → `handleLogout`
**Severity:** Low (memory/network leak)
**Description:** If a user was typing and then clicked logout, the 2-second
typing debounce timer was never cleared. After logout, the timer would fire and
call `stompRef.current.send(...)` on a disconnected (or null) client,
causing an unhandled exception.
**Fix:** Added `if (typingTimer) clearTimeout(typingTimer)` at the start of `handleLogout`.

---

### BUG #14 — Date divider always showed "Today" for all messages
**File:** `ChatApp.jsx` → messages rendering
**Severity:** Medium/UX
**Description:** There was a single hardcoded `<div className="date-divider">Today</div>`
above all messages regardless of when the messages were sent. Historical
messages from days or weeks ago all appeared under "Today".
**Fix:** Implemented a `buildGrouped()` function that groups messages by date
and inserts dividers with proper labels: "Today", "Yesterday", or a locale date.

---

### BUG #15 — Unread badge capped at "9+" instead of "99+"
**File:** `ChatApp.jsx` → contact list
**Severity:** Low/UX
**Description:** `unread > 9 ? "9+" : unread` — the cap of 9 is very low for
busy chats; 99 is the WhatsApp standard.
**Fix:** Changed to `unread > 99 ? "99+" : unread`.

---

## BACKEND NOTES (Java/Spring Boot)

The backend is functionally correct. Minor observations:

| Area | Note |
|------|------|
| `SecurityConfig.java` | Uses `permitAll()` globally — acceptable for a demo, but add JWT in production. |
| `ChatController` — `/messages/{id}` DELETE | Sends a request body with DELETE, which some proxies strip. Consider using a query param or POST-to-delete pattern for better compatibility. |
| `broadcastOnlineUsers()` | Broadcasts ALL users' info on every connect/disconnect. For large user bases, consider incremental updates. |
| `application.properties` | MongoDB URI is hardcoded (`localhost:27017`). Use environment variables for deployment. |
| `UserRepository` | `findByUsernameIgnoreCase` is good; ensure a case-insensitive unique index exists in MongoDB to prevent race-condition duplicates. |

---

## Files Delivered
- `chatapp-v2-fixed/frontend/ChatApp.jsx` — All 15 bugs fixed
- `chatapp-v2-fixed/backend/` — Original backend (no changes required)
