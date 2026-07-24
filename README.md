# Meeting Transcript Sync

A Google Apps Script that automatically collects Google Meet transcripts into
dedicated Drive folders you own — one folder per recurring meeting — so you can
share them with your team without exposing anything else in the meeting owner's
Drive.

## The problem it solves

When Google Meet transcription is enabled, transcripts land in the **meeting
owner's** Drive ("Meet Recordings" folder), mixed together with transcripts of
every other meeting they host. If you're an attendee, the files are shared with
you individually, but there's no folder you can share onward. This script gives
each meeting its own folder, filled automatically, with clean standardized
filenames like `WDR - 2026/07/22 10:00 IST`.

It works for both cases:

- **Meetings someone else owns** — copies the transcripts shared with you.
- **Meetings you own** — copies (or moves) the transcripts from your own
  Meet Recordings folder.

Privacy note: the script uses Drive search, which can only ever surface files
you already have permission to see. It cannot access anything else in anyone's
Drive.

## Setup

1. **Create one Drive folder per meeting** (e.g. `WDR Transcripts`). Open each
   folder and copy its ID from the URL — the part after `/folders/`.
2. Go to [script.google.com](https://script.google.com) → **New project** →
   paste in `Code.gs`.
3. Edit `CONFIG` at the top:
   - Set `TIMEZONE` / `TZ_LABEL` if you're not in IST.
   - Add one entry per meeting under `MEETINGS` (see reference below).
   - Optionally set `NOTIFY_EMAIL` to get a summary email on new syncs.
4. Select `syncAllTranscripts` in the toolbar dropdown → **Run**. Authorize
   when prompted (Advanced → Go to project → Allow). This first run backfills
   all existing transcripts.
5. Select `setupTrigger` → **Run** once. This creates a daily server-side
   trigger — your machine does not need to be on.
6. On the **Triggers** page (clock icon), edit the trigger and set *Failure
   notification settings* → **Notify me immediately**.
7. Share each destination folder with whoever needs it. Future transcripts
   inherit the folder's sharing automatically.

## Config reference

| Field | Meaning |
|---|---|
| `searchTerm` | Text that must appear in the transcript filename — normally the exact calendar invite title. Matching is a *contains* check. |
| `prefix` | Short code used in renamed files, e.g. `WDR` → `WDR - 2026/07/22 10:00 IST`. |
| `folderId` | Destination folder ID. Must be a folder **you** own. |
| `mode` | `copy` (default) leaves the original untouched. `move` relocates the original — only possible for transcripts you own (meetings you host). Moving does not break calendar-attachment links; Drive links are ID-based. |

Adding a new meeting later = adding one entry to `MEETINGS`. Nothing else
changes.

## How duplicates are avoided

Every synced file's source ID is recorded in Script Properties
(`COPIED_IDS`). Re-runs, backfills, and overlapping triggers never create
doubles. `resetHistory()` clears this memory if you ever want a full re-sync.

If one meeting produces two transcripts with the same start time
(transcription stopped and restarted), the second copy gets a ` (2)` suffix.

## Troubleshooting

**A meeting's transcripts aren't syncing, others are.**
Check the Executions log (play-arrow icon):

- *Run shows Failed* → almost always a bad `folderId` (placeholder not
  replaced, or typo). Meetings listed before the bad entry will still have
  synced, which makes this easy to misread as a per-meeting issue.
- *Run shows Completed but zero files for that meeting* → either the
  `searchTerm` doesn't match the actual filename (check the exact invite
  title — plural vs singular, extra spaces), or the transcripts were never
  shared with you. Google only auto-shares transcripts with the meeting host
  and co-hosts. If you can't open the transcript from the calendar event
  either, ask the owner to share it or make you a co-host.

**Trigger stopped running.**
Triggers run indefinitely, but re-authorize (run the function once manually)
after a Google account password change. The failure-notification setting in
step 6 emails you if anything breaks.

**`setupTrigger` was run more than once.**
Each run creates another trigger. Harmless (the ID check prevents double
copies) but untidy — delete extras on the Triggers page.

## Optional: clasp

If you prefer managing the script from this repo instead of the web editor,
use [clasp](https://github.com/google/clasp):

```bash
npm install -g @google/clasp
clasp login
clasp create --type standalone --title "Meeting Transcript Sync"
clasp push
```

`appsscript.json` in this repo sets the script timezone and V8 runtime.
