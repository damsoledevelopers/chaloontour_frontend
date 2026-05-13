import { normalizeRoleForApp } from './appPaths';

/**
 * Checks if a user has permission to perform an action on a specific entry.
 * Superadmin always has full access. Staff can view/edit only leads assigned to them; cannot delete.
 * Staff can create leads and upload Excel (same as superadmin for those actions).
 */
export function checkEntryPermission(entry, user, action, globalPermission) {
  if (!user || !entry) return false;
  const role = normalizeRoleForApp(user.role);
  if (role === 'superadmin') return true;
  if (role === 'staff') {
    if (action === 'delete') return false;
    const assignedId = entry.assigned_to?._id?.toString?.() || entry.assigned_to?.toString?.() || null;
    return assignedId === user.id;
  }
  return globalPermission;
}

export function canDeleteLead(user) {
  return normalizeRoleForApp(user?.role) === 'superadmin';
}

export function canUploadExcel(user) {
  const r = normalizeRoleForApp(user?.role);
  return r === 'superadmin' || r === 'staff';
}

export function canEditPayment(user) {
  return normalizeRoleForApp(user?.role) === 'superadmin';
}

export function canCreateLead(user) {
  const r = normalizeRoleForApp(user?.role);
  return r === 'superadmin' || r === 'staff';
}

export function canAssignLead(user) {
  return normalizeRoleForApp(user?.role) === 'superadmin';
}
