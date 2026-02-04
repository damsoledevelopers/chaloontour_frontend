/**
 * Checks if a user has permission to perform an action on a specific entry.
 * Super Admin always has full access.
 */
export function checkEntryPermission(entry, user, action, globalPermission) {
  if (!user || !entry) return false;
  if (user.role === 'super_admin') return true;
  const entryPerms = entry.entryPermissions?.[user.role];
  if (entryPerms && typeof entryPerms[action] === 'boolean') return entryPerms[action];
  return globalPermission;
}
