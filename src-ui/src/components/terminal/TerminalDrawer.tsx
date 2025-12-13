/**
 * TerminalDrawer Component
 *
 * Right-side drawer panel for terminal workspace.
 * Contains session history, quick actions, and terminal settings.
 * Supports restoring sessions from history.
 */

import React, { useMemo } from 'react';
import {
  X,
  History,
  Terminal,
  Clock,
  Trash2,
  Plus,
  Server,
  XCircle,
  CheckCircle,
  FolderOpen,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useTerminalStore, SessionHistoryEntry } from '../../store/terminalStore';

interface TerminalDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Callback to create new terminal */
  onNewTerminal: () => void;
  /** Callback to clear all terminals */
  onClearAll: () => void;
  /** Callback to restore a session from history */
  onRestoreSession: (entry: SessionHistoryEntry) => void;
  /** Current active sessions count */
  activeCount: number;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * History item component
 */
const HistoryItem: React.FC<{
  entry: SessionHistoryEntry;
  onRestore: () => void;
  onRemove: () => void;
}> = ({ entry, onRestore, onRemove }) => {
  return (
    <div
      className="group flex items-start gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
      onClick={onRestore}
      title="Click to restore this session"
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          entry.exitedNormally === false
            ? 'bg-red-500/20 text-red-400'
            : 'bg-gray-700/50 text-gray-400'
        }`}
      >
        {entry.exitedNormally === false ? (
          <XCircle className="w-4 h-4" />
        ) : entry.closedAt ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Terminal className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {entry.name}
          </span>
          {entry.configName && (
            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
              {entry.configName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatRelativeTime(entry.createdAt)}</span>
          {entry.workDir && (
            <>
              <FolderOpen className="w-3 h-3 ml-2" />
              <span className="truncate max-w-[100px]" title={entry.workDir}>
                {entry.workDir.split('/').pop()}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
          title="Restore session"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          title="Remove from history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Terminal Drawer Component
 */
export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen,
  onClose,
  onNewTerminal,
  onClearAll,
  onRestoreSession,
  activeCount,
}) => {
  const { history, removeFromHistory, clearHistory } = useTerminalStore();

  // Group history by date
  const groupedHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; entries: SessionHistoryEntry[] }[] = [
      { label: 'Today', entries: [] },
      { label: 'Yesterday', entries: [] },
      { label: 'This Week', entries: [] },
      { label: 'Earlier', entries: [] },
    ];

    history.forEach((entry) => {
      const date = new Date(entry.createdAt);
      if (date >= today) {
        groups[0].entries.push(entry);
      } else if (date >= yesterday) {
        groups[1].entries.push(entry);
      } else if (date >= weekAgo) {
        groups[2].entries.push(entry);
      } else {
        groups[3].entries.push(entry);
      }
    });

    return groups.filter((g) => g.entries.length > 0);
  }, [history]);

  const handleRestore = (entry: SessionHistoryEntry) => {
    onRestoreSession(entry);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-800
          transform transition-transform duration-300 ease-out z-50
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Terminal</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick Actions */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onNewTerminal}
                className="flex items-center gap-2 px-3 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New</span>
              </button>
              <button
                onClick={onClearAll}
                disabled={activeCount === 0}
                className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:text-gray-600 disabled:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Close All</span>
              </button>
            </div>
          </div>

          {/* Active Sessions Stats */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Status
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Server className="w-4 h-4" />
                  <span className="text-xs">Active</span>
                </div>
                <span className="text-2xl font-bold text-white">
                  {activeCount}
                </span>
              </div>
              <div className="flex-1 bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <History className="w-4 h-4" />
                  <span className="text-xs">History</span>
                </div>
                <span className="text-2xl font-bold text-white">
                  {history.length}
                </span>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Session History
              </h3>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all history?')) {
                      clearHistory();
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No session history</p>
                <p className="text-xs text-gray-600 mt-1">
                  Closed sessions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Hint */}
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  Click to restore session
                </p>
                {groupedHistory.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronRight className="w-3 h-3 text-gray-600" />
                      <span className="text-xs font-medium text-gray-500">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <HistoryItem
                          key={entry.id}
                          entry={entry}
                          onRestore={() => handleRestore(entry)}
                          onRemove={() => removeFromHistory(entry.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Terminal Workspace</span>
            <span>v1.2.1</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default TerminalDrawer;
