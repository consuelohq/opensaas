import { useCallback, useEffect, useRef, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

import {
  DEFAULT_WORKSPACE,
  WORKSPACE_STORAGE_KEY,
} from '@/settings/types/workspace';
import type {
  TeamMember,
  TeamRole,
  WorkspaceBranding,
  WorkspaceConfig,
} from '@/settings/types/workspace';

const loadFromStorage = (): WorkspaceConfig => {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) return { ...DEFAULT_WORKSPACE, ...JSON.parse(raw) };
  } catch {
    // fall through
  }
  return DEFAULT_WORKSPACE;
};

const saveToStorage = (ws: WorkspaceConfig) => {
  const safe = {
    ...ws,
    billing: { ...ws.billing, stripeCustomerId: undefined },
  };
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(safe));
};

const api = (path: string, opts?: RequestInit) =>
  fetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });

export const useWorkspaceSettings = () => {
  const [workspace, setWorkspace] = useState<WorkspaceConfig>(loadFromStorage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchWorkspace = async () => {
      try {
        const res = await api('/v1/workspaces/current');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as WorkspaceConfig;
        if (mountedRef.current) {
          const merged = { ...DEFAULT_WORKSPACE, ...data };
          setWorkspace(merged);
          saveToStorage(merged);
        }
      } catch {
        // API unavailable — localStorage values already loaded
        if (mountedRef.current) setError('Failed to load workspace settings');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    void fetchWorkspace();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const update = useCallback((patch: Partial<WorkspaceConfig>) => {
    setWorkspace((prev) => {
      const next = { ...prev, ...patch };
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateWorkspace = useCallback(
    async (patch: { name?: string; slug?: string }) => {
      try {
        setError(null);
        const res = await api(`/v1/workspaces/${workspace.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        update(patch);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Update failed';
        setError(msg);
        throw err;
      }
    },
    [workspace.id, update],
  );

  const updateBranding = useCallback(
    async (branding: WorkspaceBranding) => {
      try {
        setError(null);
        const res = await api(`/v1/workspaces/${workspace.id}/branding`, {
          method: 'PUT',
          body: JSON.stringify(branding),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        update({ branding });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Branding update failed';
        setError(msg);
        throw err;
      }
    },
    [workspace.id, update],
  );

  const inviteMember = useCallback(
    async (email: string, role: TeamRole) => {
      try {
        setError(null);
        const res = await api(`/v1/workspaces/${workspace.id}/invites`, {
          method: 'POST',
          body: JSON.stringify({ email, role }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const raw = await res.json();
        // transform raw DB row to TeamMember shape
        const member: TeamMember = {
          id: raw.id,
          email: raw.email,
          name: '',
          avatarUrl: null,
          role: raw.role,
          status: raw.status,
          invitedAt: raw.created_at,
          lastActiveAt: null,
        };
        setWorkspace((prev) => {
          const next = {
            ...prev,
            team: [...prev.team, member],
            billing: {
              ...prev.billing,
              seats: { ...prev.billing.seats, used: prev.billing.seats.used + 1 },
            },
          };
          saveToStorage(next);
          return next;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invite failed';
        setError(msg);
        throw err;
      }
    },
    [workspace.id],
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: TeamRole) => {
      try {
        setError(null);
        const res = await api(
          `/v1/workspaces/${workspace.id}/members/${memberId}`,
          { method: 'PATCH', body: JSON.stringify({ role }) },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setWorkspace((prev) => {
          const next = {
            ...prev,
            team: prev.team.map((m) => (m.id === memberId ? { ...m, role } : m)),
          };
          saveToStorage(next);
          return next;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Role update failed';
        setError(msg);
        throw err;
      }
    },
    [workspace.id],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      try {
        setError(null);
        const res = await api(
          `/v1/workspaces/${workspace.id}/members/${memberId}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setWorkspace((prev) => {
          const next = {
            ...prev,
            team: prev.team.filter((m) => m.id !== memberId),
            billing: {
              ...prev.billing,
              seats: { ...prev.billing.seats, used: prev.billing.seats.used - 1 },
            },
          };
          saveToStorage(next);
          return next;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Remove failed';
        setError(msg);
        throw err;
      }
    },
    [workspace.id],
  );

  const openBillingPortal = useCallback(async () => {
    try {
      setError(null);
      const res = await api(`/v1/workspaces/${workspace.id}/billing/portal`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Billing portal failed';
      setError(msg);
      throw err;
    }
  }, [workspace.id]);

  return {
    workspace,
    loading,
    error,
    updateWorkspace,
    updateBranding,
    inviteMember,
    updateMemberRole,
    removeMember,
    openBillingPortal,
  };
};
