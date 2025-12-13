/**
 * Terminal State Management Store
 *
 * Manages terminal sessions, output buffers, and session history.
 * Terminal sessions continue running in the background even when switching pages.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TerminalTab } from '../components/terminal';

/** Maximum buffer size per session (characters) */
const MAX_BUFFER_SIZE = 500000; // ~500KB per session

/** Maximum history entries */
const MAX_HISTORY_ENTRIES = 50;

/** Default group ID */
const DEFAULT_GROUP_ID = 'default';

/** Terminal group */
export interface TerminalGroup {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Sort order */
  order: number;
  /** Whether group is collapsed */
  collapsed: boolean;
  /** Created timestamp */
  createdAt: string;
}

/** Session history entry */
export interface SessionHistoryEntry {
  /** Unique ID */
  id: string;
  /** Session ID (from PTY) */
  sessionId: string;
  /** Display name */
  name: string;
  /** Config ID used */
  configId: number;
  /** Config name */
  configName?: string;
  /** Created timestamp */
  createdAt: string;
  /** Closed timestamp */
  closedAt?: string;
  /** Working directory */
  workDir?: string;
  /** Whether session ended normally */
  exitedNormally?: boolean;
}

interface TerminalState {
  // Active tabs
  tabs: TerminalTab[];
  // Currently active session ID
  activeSessionId: string | null;
  // Output buffers for each session (session_id -> output string)
  outputBuffers: Map<string, string>;
  // Whether initial data has been loaded
  initialized: boolean;
  // Session history (persisted)
  history: SessionHistoryEntry[];
  // Drawer open state
  drawerOpen: boolean;
  // Terminal groups
  groups: TerminalGroup[];
  // Currently active group ID
  activeGroupId: string;
  // Tab to group mapping (sessionId -> groupId)
  tabGroupMap: Record<string, string>;

  // Tab Actions
  setTabs: (tabs: TerminalTab[]) => void;
  addTab: (tab: TerminalTab, groupId?: string) => void;
  removeTab: (sessionId: string) => void;
  updateTab: (sessionId: string, updates: Partial<TerminalTab>) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  moveTabToGroup: (sessionId: string, groupId: string) => void;

  // Output Buffer Actions
  appendOutput: (sessionId: string, data: string) => void;
  getOutputBuffer: (sessionId: string) => string;
  clearOutputBuffer: (sessionId: string) => void;

  // History Actions
  addToHistory: (entry: Omit<SessionHistoryEntry, 'id'>) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  updateHistoryEntry: (id: string, updates: Partial<SessionHistoryEntry>) => void;

  // UI Actions
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  // Group Actions
  addGroup: (name: string) => string;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<TerminalGroup>) => void;
  setActiveGroupId: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  reorderGroups: (groupIds: string[]) => void;
  getTabsInGroup: (groupId: string) => TerminalTab[];

  // Other Actions
  setInitialized: (value: boolean) => void;
  reset: () => void;
}

/**
 * Terminal Store
 * Partially persistent (history is persisted, buffers are not)
 */
export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      // Initial state
      tabs: [],
      activeSessionId: null,
      outputBuffers: new Map(),
      initialized: false,
      history: [],
      drawerOpen: false,
      groups: [
        {
          id: DEFAULT_GROUP_ID,
          name: '默认分组',
          order: 0,
          collapsed: false,
          createdAt: new Date().toISOString(),
        },
      ],
      activeGroupId: DEFAULT_GROUP_ID,
      tabGroupMap: {},

      // Set all tabs
      setTabs: (tabs) => set({ tabs }),

      // Add a new tab to a group
      addTab: (tab, groupId) =>
        set((state) => {
          const targetGroupId = groupId || state.activeGroupId;
          return {
            tabs: [...state.tabs, tab],
            tabGroupMap: {
              ...state.tabGroupMap,
              [tab.sessionId]: targetGroupId,
            },
          };
        }),

      // Remove a tab
      removeTab: (sessionId) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.sessionId !== sessionId);
          const newBuffers = new Map(state.outputBuffers);
          newBuffers.delete(sessionId);

          // Remove from tab group map
          const newTabGroupMap = { ...state.tabGroupMap };
          delete newTabGroupMap[sessionId];

          // If removing active tab, switch to another in same group
          let newActiveId = state.activeSessionId;
          if (sessionId === state.activeSessionId) {
            const currentGroupId = state.tabGroupMap[sessionId] || DEFAULT_GROUP_ID;
            const tabsInGroup = newTabs.filter(
              (t) => (newTabGroupMap[t.sessionId] || DEFAULT_GROUP_ID) === currentGroupId
            );
            newActiveId = tabsInGroup.length > 0 ? tabsInGroup[tabsInGroup.length - 1].sessionId : null;
          }

          return {
            tabs: newTabs,
            outputBuffers: newBuffers,
            activeSessionId: newActiveId,
            tabGroupMap: newTabGroupMap,
          };
        }),

      // Update a tab
      updateTab: (sessionId, updates) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.sessionId === sessionId ? { ...t, ...updates } : t
          ),
        })),

      // Set active session - also switch to the group containing this session
      setActiveSessionId: (sessionId) =>
        set((state) => {
          if (!sessionId) {
            return { activeSessionId: null };
          }

          // Find which group this session belongs to
          const sessionGroupId = state.tabGroupMap[sessionId] || DEFAULT_GROUP_ID;

          // Update both active session and active group
          return {
            activeSessionId: sessionId,
            activeGroupId: sessionGroupId,
          };
        }),

      // Move tab to a different group
      moveTabToGroup: (sessionId, groupId) =>
        set((state) => ({
          tabGroupMap: {
            ...state.tabGroupMap,
            [sessionId]: groupId,
          },
        })),

      // Append output to buffer
      appendOutput: (sessionId, data) =>
        set((state) => {
          const newBuffers = new Map(state.outputBuffers);
          const existing = newBuffers.get(sessionId) || '';
          let newBuffer = existing + data;

          // Trim buffer if too large (keep last part)
          if (newBuffer.length > MAX_BUFFER_SIZE) {
            newBuffer = newBuffer.slice(-MAX_BUFFER_SIZE);
          }

          newBuffers.set(sessionId, newBuffer);
          return { outputBuffers: newBuffers };
        }),

      // Get output buffer for a session
      getOutputBuffer: (sessionId) => {
        return get().outputBuffers.get(sessionId) || '';
      },

      // Clear output buffer
      clearOutputBuffer: (sessionId) =>
        set((state) => {
          const newBuffers = new Map(state.outputBuffers);
          newBuffers.delete(sessionId);
          return { outputBuffers: newBuffers };
        }),

      // Add session to history
      addToHistory: (entry) =>
        set((state) => {
          const newEntry: SessionHistoryEntry = {
            ...entry,
            id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          };

          let newHistory = [newEntry, ...state.history];

          // Limit history size
          if (newHistory.length > MAX_HISTORY_ENTRIES) {
            newHistory = newHistory.slice(0, MAX_HISTORY_ENTRIES);
          }

          return { history: newHistory };
        }),

      // Remove from history
      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        })),

      // Clear all history
      clearHistory: () => set({ history: [] }),

      // Update history entry
      updateHistoryEntry: (id, updates) =>
        set((state) => ({
          history: state.history.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      // Set drawer open state
      setDrawerOpen: (open) => set({ drawerOpen: open }),

      // Toggle drawer
      toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

      // Add a new group
      addGroup: (name) => {
        const id = `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id,
              name,
              order: state.groups.length,
              collapsed: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      // Remove a group (moves tabs to default group)
      removeGroup: (groupId) =>
        set((state) => {
          // Can't remove default group
          if (groupId === DEFAULT_GROUP_ID) return state;

          // Move all tabs in this group to default
          const newTabGroupMap = { ...state.tabGroupMap };
          Object.keys(newTabGroupMap).forEach((sessionId) => {
            if (newTabGroupMap[sessionId] === groupId) {
              newTabGroupMap[sessionId] = DEFAULT_GROUP_ID;
            }
          });

          return {
            groups: state.groups.filter((g) => g.id !== groupId),
            tabGroupMap: newTabGroupMap,
            activeGroupId:
              state.activeGroupId === groupId ? DEFAULT_GROUP_ID : state.activeGroupId,
          };
        }),

      // Update a group
      updateGroup: (groupId, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        })),

      // Set active group - if group has tabs, select the first one
      setActiveGroupId: (groupId) =>
        set((state) => {
          // Get first tab in the target group
          const tabsInGroup = state.tabs.filter(
            (t) => (state.tabGroupMap[t.sessionId] || DEFAULT_GROUP_ID) === groupId
          );

          // If group has tabs and current active session is not in this group,
          // switch to the first tab in the group
          const currentSessionGroup = state.activeSessionId
            ? state.tabGroupMap[state.activeSessionId] || DEFAULT_GROUP_ID
            : null;

          let newActiveSessionId = state.activeSessionId;

          // If switching to a different group and it has tabs, select the first tab
          if (currentSessionGroup !== groupId && tabsInGroup.length > 0) {
            newActiveSessionId = tabsInGroup[0].sessionId;
          }

          return {
            activeGroupId: groupId,
            activeSessionId: newActiveSessionId,
          };
        }),

      // Toggle group collapsed state
      toggleGroupCollapsed: (groupId) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          ),
        })),

      // Reorder groups
      reorderGroups: (groupIds) =>
        set((state) => ({
          groups: groupIds.map((id, index) => {
            const group = state.groups.find((g) => g.id === id);
            return group ? { ...group, order: index } : null;
          }).filter(Boolean) as TerminalGroup[],
        })),

      // Get tabs in a specific group
      getTabsInGroup: (groupId) => {
        const state = get();
        return state.tabs.filter(
          (t) => (state.tabGroupMap[t.sessionId] || DEFAULT_GROUP_ID) === groupId
        );
      },

      // Set initialized flag
      setInitialized: (value) => set({ initialized: value }),

      // Reset store
      reset: () =>
        set({
          tabs: [],
          activeSessionId: null,
          outputBuffers: new Map(),
          initialized: false,
          tabGroupMap: {},
          // Keep history, groups on reset
        }),
    }),
    {
      name: 'terminal-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist history, drawer state, groups, and tab-group mapping
      partialize: (state) => ({
        history: state.history,
        drawerOpen: state.drawerOpen,
        groups: state.groups,
        activeGroupId: state.activeGroupId,
        tabGroupMap: state.tabGroupMap,
      }),
    }
  )
);
