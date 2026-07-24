/**
 * Meeting Transcript Sync
 * ------------------------
 * Collects Google Meet transcripts into dedicated Drive folders you own —
 * one folder per meeting — so they can be shared independently of the
 * meeting owner's Drive.
 *
 * Works for transcripts shared with you AND transcripts you own (i.e.
 * meetings you host yourself). Runs unattended on a daily time trigger.
 *
 * Quick start:
 *   1. Fill in CONFIG below (one entry per meeting).
 *   2. Run syncAllTranscripts() once manually → authorize + backfill.
 *   3. Run setupTrigger() once → daily schedule on Google's servers.
 *
 * See README.md for full setup and troubleshooting.
 */

const CONFIG = {
  /** Timezone used for fallback timestamps and its display label. */
  TIMEZONE: 'Asia/Kolkata',
  TZ_LABEL: 'IST',

  /** Word that must appear in the file title (Google appends this). */
  TRANSCRIPT_KEYWORD: 'Transcript',

  /**
   * Optional: set your email to get a one-line summary whenever new
   * transcripts are synced. Leave '' to disable. Doubles as a heartbeat —
   * no email on a meeting day means something needs a look.
   */
  NOTIFY_EMAIL: '',

  /**
   * One entry per meeting:
   *   searchTerm — must appear in the transcript filename (usually the
   *                exact calendar invite title)
   *   prefix     — short code used in the renamed copy, e.g. 'WDR'
   *   folderId   — destination Drive folder ID (a folder YOU own)
   *   mode       — 'copy' (default; original untouched) or 'move'
   *                ('move' only works for transcripts you own, e.g.
   *                meetings you host — keeps a single file, no duplicate)
   */
  MEETINGS: [
    {
      searchTerm: 'Weekly Delivery Review',
      prefix: 'WDR',
      folderId: 'PASTE_FOLDER_ID',
      mode: 'copy',
    },
    {
      searchTerm: 'Weekly Business Review',
      prefix: 'WBR',
      folderId: 'PASTE_FOLDER_ID',
      mode: 'copy',
    },
    {
      searchTerm: 'Weekly Margins Review',
      prefix: 'WMR',
      folderId: 'PASTE_FOLDER_ID',
      mode: 'copy',
    },
  ],
};

/** Main entry point — safe to run any number of times. */
function syncAllTranscripts() {
  const props = PropertiesService.getScriptProperties();
  const syncedIds = JSON.parse(props.getProperty('COPIED_IDS') || '[]');
  const summary = [];

  CONFIG.MEETINGS.forEach(function (meeting) {
    const destFolder = DriveApp.getFolderById(meeting.folderId);

    // Drive search can only surface files you already have access to —
    // it can never see anything else in another person's Drive.
    const query =
      "title contains '" + meeting.searchTerm + "'" +
      " and title contains '" + CONFIG.TRANSCRIPT_KEYWORD + "'" +
      ' and trashed = false';

    const files = DriveApp.searchFiles(query);

    while (files.hasNext()) {
      const file = files.next();
      const id = file.getId();
      if (syncedIds.indexOf(id) !== -1) continue; // already synced

      const name = uniqueName(buildName(file, meeting.prefix), destFolder);

      if (meeting.mode === 'move') {
        file.setName(name).moveTo(destFolder);
      } else {
        file.makeCopy(name, destFolder);
      }

      syncedIds.push(id);
      summary.push('[' + meeting.prefix + '] ' + name);
      Logger.log('[' + meeting.prefix + '] Synced: ' + name);
    }
  });

  props.setProperty('COPIED_IDS', JSON.stringify(syncedIds));
  Logger.log(summary.length + ' new transcript(s) synced.');

  if (CONFIG.NOTIFY_EMAIL && summary.length > 0) {
    MailApp.sendEmail(
      CONFIG.NOTIFY_EMAIL,
      'Transcript Sync: ' + summary.length + ' new file(s)',
      summary.join('\n')
    );
  }
}

/**
 * Builds "<PREFIX> - yyyy/MM/dd HH:mm <TZ_LABEL>".
 * Meet transcript titles embed the meeting start time, e.g.
 * "Weekly Business Review - 2026/07/23 09:45 GMT+05:30 - Transcript",
 * so the date/time is lifted from the title. If the format ever changes,
 * falls back to the file's creation timestamp in CONFIG.TIMEZONE.
 */
function buildName(file, prefix) {
  const m = file.getName().match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{1,2}:\d{2})/);
  if (m) return prefix + ' - ' + m[1] + ' ' + m[2] + ' ' + CONFIG.TZ_LABEL;

  const fallback = Utilities.formatDate(
    file.getDateCreated(),
    CONFIG.TIMEZONE,
    'yyyy/MM/dd HH:mm'
  );
  return prefix + ' - ' + fallback + ' ' + CONFIG.TZ_LABEL;
}

/**
 * If a file with this name already exists in the folder (e.g. transcription
 * was stopped and restarted mid-meeting, producing two files with the same
 * start time), append " (2)", " (3)", etc.
 */
function uniqueName(baseName, folder) {
  let name = baseName;
  let i = 2;
  while (folder.getFilesByName(name).hasNext()) {
    name = baseName + ' (' + i + ')';
    i++;
  }
  return name;
}

/** Run ONCE to schedule the daily sync (~1 PM script timezone). */
function setupTrigger() {
  ScriptApp.newTrigger('syncAllTranscripts')
    .timeBased()
    .everyDays(1)
    .atHour(13)
    .create();
}

/** Reset the synced-file memory (next run re-syncs everything). */
function resetHistory() {
  PropertiesService.getScriptProperties().deleteProperty('COPIED_IDS');
}
