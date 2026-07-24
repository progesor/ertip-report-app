export const APP_ROLES = ['owner', 'manager'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  'reports:read',
  'reports:export',
  'admin:connections',
  'admin:reports',
  'admin:users',
  'admin:sync',
  'admin:data-quality',
  'admin:audit',
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

const rolePermissions = {
  owner: new Set<AppPermission>(APP_PERMISSIONS),
  manager: new Set<AppPermission>(['reports:read', 'reports:export']),
} satisfies Record<AppRole, ReadonlySet<AppPermission>>;

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function can(role: AppRole, permission: AppPermission): boolean {
  return rolePermissions[role].has(permission);
}

export function canAccessBusinessUnit(
  role: AppRole,
  allowedBusinessUnitIds: readonly string[],
  requestedBusinessUnitId: string,
): boolean {
  if (role === 'owner') {
    return true;
  }

  return allowedBusinessUnitIds.includes(requestedBusinessUnitId);
}
