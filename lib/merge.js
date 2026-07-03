function entryTime(entry) {
  return entry.updatedAt || entry.createdAt || '';
}

function mergeSyncData(local, remote) {
  const deleted = new Set([...(local.deletedIds || []), ...(remote.deletedIds || [])]);
  const entryMap = new Map();

  for (const entry of remote.entries || []) {
    if (!deleted.has(entry.id)) entryMap.set(entry.id, entry);
  }

  for (const entry of local.entries || []) {
    if (deleted.has(entry.id)) continue;
    const existing = entryMap.get(entry.id);
    if (!existing || entryTime(entry) >= entryTime(existing)) {
      entryMap.set(entry.id, entry);
    }
  }

  const localKey = local.settings?.apiKey || '';
  const remoteKey = remote.settings?.apiKey || '';
  let apiKey = localKey || remoteKey;
  let settingsUpdatedAt = local.settingsUpdatedAt || remote.settingsUpdatedAt || null;

  if (localKey && remoteKey) {
    const localTs = local.settingsUpdatedAt || '';
    const remoteTs = remote.settingsUpdatedAt || '';
    if (remoteTs > localTs) {
      apiKey = remoteKey;
      settingsUpdatedAt = remoteTs;
    } else {
      apiKey = localKey;
      settingsUpdatedAt = localTs || settingsUpdatedAt;
    }
  }

  const entries = Array.from(entryMap.values()).sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return entryTime(b).localeCompare(entryTime(a));
  });

  return {
    entries,
    settings: { apiKey },
    settingsUpdatedAt,
    deletedIds: Array.from(deleted),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { mergeSyncData };