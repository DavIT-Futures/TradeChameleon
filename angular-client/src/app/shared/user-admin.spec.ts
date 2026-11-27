import { describe, expect, it } from 'vitest';
import type { ManagedUser } from '../api/types';
import { selfLockout, sortUsers, summary, toggleRole } from './user-admin';

const user = (id: string, email: string, roles: ManagedUser['roles'], enabled = true): ManagedUser =>
  ({ id, email, name: email, roles, enabled, createdAt: '2026-01-02T09:00:00Z' }) as ManagedUser;

describe('user admin helpers', () => {
  it('toggles roles in canonical order', () => {
    expect(toggleRole(['VIEWER'], 'TRADER')).toEqual(['TRADER', 'VIEWER']);
    expect(toggleRole(['TRADER', 'MAINTAINER'], 'TRADER')).toEqual(['MAINTAINER']);
  });

  it('refuses only changes that would lock the signed-in user out', () => {
    const me = user('1', 'm@x.test', ['MAINTAINER', 'VIEWER']);
    expect(selfLockout(me, '1', 'delete')).toContain('delete');
    expect(selfLockout(me, '1', { roles: ['MAINTAINER'], enabled: false })).toContain('disable');
    expect(selfLockout(me, '1', { roles: ['VIEWER'], enabled: true })).toContain('MAINTAINER');
    expect(selfLockout(me, '1', { roles: ['MAINTAINER'], enabled: true })).toBeNull();
    expect(selfLockout(me, '2', 'delete')).toBeNull();
    expect(selfLockout(me, null, 'delete')).toBeNull(); // platform console: never "self"
  });

  it('sorts maintainers first and summarises', () => {
    const list = [user('1', 'b@x.test', ['TRADER']), user('2', 'z@x.test', ['MAINTAINER']), user('3', 'a@x.test', ['VIEWER'], false)];
    expect(sortUsers(list).map((u) => u.email)).toEqual(['z@x.test', 'a@x.test', 'b@x.test']);
    expect(summary(list)).toBe('3 users · 1 disabled');
    expect(summary([list[0]])).toBe('1 user');
  });
});
