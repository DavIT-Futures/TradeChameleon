/**
 * Pure helpers for the user management table in the admin pages. Identical copy in the React client.
 * The server enforces every rule; these only keep the UI from offering what would be refused.
 */
import type { ManagedUser, Role } from '../api/types';

export const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: 'TRADER', label: 'Trader', hint: 'Places and cancels orders' },
  { key: 'VIEWER', label: 'Viewer', hint: 'Read-only access' },
  { key: 'MAINTAINER', label: 'Maintainer', hint: 'Edits this broker and its users' },
];

/** Toggles one role, keeping the canonical order. */
export function toggleRole(roles: readonly Role[], role: Role): Role[] {
  const set = new Set(roles);
  if (set.has(role)) set.delete(role);
  else set.add(role);
  return ROLES.map((r) => r.key).filter((k) => set.has(k));
}

/**
 * Why the signed-in user may not make this change to their own account (the server answers 422
 * self-lockout), or null when it is fine. `selfId` is null in the platform console.
 */
export function selfLockout(user: ManagedUser, selfId: string | null, next: { roles: readonly Role[]; enabled: boolean } | 'delete'): string | null {
  if (selfId === null || user.id !== selfId) return null;
  if (next === 'delete') return 'You cannot delete your own account.';
  if (!next.enabled) return 'You cannot disable your own account.';
  if (user.roles.includes('MAINTAINER') && !next.roles.includes('MAINTAINER')) return 'You cannot remove your own MAINTAINER role.';
  return null;
}

/** Users sorted for the table: maintainers first, then by e-mail. */
export function sortUsers(users: readonly ManagedUser[]): ManagedUser[] {
  const rank = (u: ManagedUser) => (u.roles.includes('MAINTAINER') ? 0 : 1);
  return [...users].sort((a, b) => rank(a) - rank(b) || a.email.localeCompare(b.email));
}

/** Counts for the summary line: "5 users · 1 disabled". */
export function summary(users: readonly ManagedUser[]): string {
  const disabled = users.filter((u) => !u.enabled).length;
  return `${users.length} user${users.length === 1 ? '' : 's'}${disabled ? ` · ${disabled} disabled` : ''}`;
}
