function getRole(userOrRole) {
  if (!userOrRole) return null;
  if (typeof userOrRole === 'string') return userOrRole;
  return userOrRole.role || null;
}

/** Align with backend resolveCrmRole: portal/CRM aliases → staff, super_admin → superadmin */
export function normalizeRoleForApp(role) {
  if (role == null || role === '') return role;
  const r = String(role).replace(/\u00a0/g, ' ').trim().toLowerCase();
  if (r === 'portal' || r === 'agent' || r === 'portal_user' || r === 'b2b') return 'staff';
  if (r === 'super_admin' || r === 'superadmin') return 'superadmin';
  if (r === 'staff') return 'staff';
  const staffAliases = new Set([
    'sales', 'partner', 'user', 'member', 'employee', 'field_agent', 'consultant', 'associate',
    'rep', 'sales_rep', 'travel_agent', 'agent_portal'
  ]);
  if (staffAliases.has(r) || (r.includes('portal') && !r.includes('superadmin'))) return 'staff';
  return r;
}

export function isPortalUser(userOrRole) {
  const r = normalizeRoleForApp(getRole(userOrRole));
  return r === 'staff';
}

export function getAppBasePath(userOrRole) {
  return isPortalUser(userOrRole) ? '/portal' : '/admin';
}

export function getScopedPath(userOrRole, path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppBasePath(userOrRole)}${normalizedPath}`;
}

export function getRoleHomePath(userOrRole) {
  return getScopedPath(userOrRole, '/dashboard');
}

export function getLeadsPath(userOrRole, suffix = '') {
  return `${getScopedPath(userOrRole, '/leads')}${suffix}`;
}
