/**
 * TerminalSidebar Component
 *
 * Left sidebar for terminal group management.
 * Displays groups with their tabs, supports add/remove/rename groups.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  FolderClosed,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Terminal,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { useTerminalStore, TerminalGroup } from '../../store/terminalStore';
import { TerminalTab } from './TerminalTabBar';

interface TerminalSidebarProps {
  /** Callback when new terminal is requested for a group */
  onNewTerminal: (groupId: string) => void;
  /** Callback when tab is selected */
  onSelectTab: (sessionId: string) => void;
  /** Callback when tab is closed */
  onCloseTab: (sessionId: string) => void;
}

/**
 * Group context menu
 */
const GroupContextMenu: React.FC<{
  group: TerminalGroup;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}> = ({ group, position, onClose, onRename, onDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const isDefault = group.id === 'default';

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        <Pencil className="w-4 h-4" />
        <span>重命名</span>
      </button>
      {!isDefault && (
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>删除分组</span>
        </button>
      )}
    </div>
  );
};

/**
 * Inline edit input for group name
 */
const InlineEdit: React.FC<{
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}> = ({ value, onSave, onCancel }) => {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full bg-gray-700 border border-yellow-500/50 rounded px-2 py-1 text-sm text-white outline-none"
    />
  );
};

/**
 * Single group item with tabs
 */
const GroupItem: React.FC<{
  group: TerminalGroup;
  tabs: TerminalTab[];
  isActive: boolean;
  activeSessionId: string | null;
  onSelect: () => void;
  onNewTerminal: () => void;
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
}> = ({
  group,
  tabs,
  isActive,
  activeSessionId,
  onSelect,
  onNewTerminal,
  onSelectTab,
  onCloseTab,
}) => {
  const { toggleGroupCollapsed, updateGroup, removeGroup } = useTerminalStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = (newName: string) => {
    updateGroup(group.id, { name: newName });
    setIsEditing(false);
  };

  return (
    <div className="mb-1">
      {/* Group header */}
      <div
        className={`
          group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
          ${isActive ? 'bg-yellow-500/10 text-yellow-400' : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'}
        `}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        {/* Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupCollapsed(group.id);
          }}
          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
        >
          {group.collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder icon */}
        {group.collapsed ? (
          <FolderClosed className="w-4 h-4 flex-shrink-0" />
        ) : (
          <FolderOpen className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Group name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <InlineEdit
              value={group.name}
              onSave={handleRename}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <span className="text-sm font-medium truncate block">{group.name}</span>
          )}
        </div>

        {/* Tab count badge */}
        <span className="text-xs px-1.5 py-0.5 bg-gray-700/50 rounded">
          {tabs.length}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewTerminal();
            }}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="在此分组新建终端"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="更多操作"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs list (when not collapsed) */}
      {!group.collapsed && tabs.length > 0 && (
        <div className="ml-4 mt-1 space-y-0.5">
          {tabs.map((tab) => {
            const isTabActive = tab.sessionId === activeSessionId;
            return (
              <div
                key={tab.sessionId}
                className={`
                  group/tab flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors
                  ${isTabActive ? 'bg-gray-800 text-yellow-400' : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'}
                `}
                onClick={() => onSelectTab(tab.sessionId)}
              >
                {/* Status indicator */}
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    tab.isRunning ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-sm truncate">
                  {tab.name || `Terminal ${tab.sessionId.slice(-4)}`}
                </span>
                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.sessionId);
                  }}
                  className="p-0.5 opacity-0 group-hover/tab:opacity-100 hover:bg-gray-700 rounded transition-all"
                  title="关闭"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <GroupContextMenu
          group={group}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onRename={() => setIsEditing(true)}
          onDelete={() => removeGroup(group.id)}
        />
      )}
    </div>
  );
};

/**
 * Terminal Sidebar Component
 */
export const TerminalSidebar: React.FC<TerminalSidebarProps> = ({
  onNewTerminal,
  onSelectTab,
  onCloseTab,
}) => {
  const {
    groups,
    activeGroupId,
    activeSessionId,
    tabs,
    tabGroupMap,
    addGroup,
    setActiveGroupId,
  } = useTerminalStore();

  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // Get tabs for each group
  const getTabsForGroup = (groupId: string) => {
    return tabs.filter((t) => (tabGroupMap[t.sessionId] || 'default') === groupId);
  };

  // Sort groups by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const handleAddGroup = (name: string) => {
    const newGroupId = addGroup(name);
    setActiveGroupId(newGroupId);
    setIsAddingGroup(false);
  };

  return (
    <div className="w-56 h-full bg-gray-900/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">分组</h3>
        <button
          onClick={() => setIsAddingGroup(true)}
          className="p-1 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
          title="新建分组"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* New group input */}
        {isAddingGroup && (
          <div className="mb-2 px-2">
            <InlineEdit
              value="新分组"
              onSave={handleAddGroup}
              onCancel={() => setIsAddingGroup(false)}
            />
          </div>
        )}

        {/* Group items */}
        {sortedGroups.map((group) => (
          <GroupItem
            key={group.id}
            group={group}
            tabs={getTabsForGroup(group.id)}
            isActive={group.id === activeGroupId}
            activeSessionId={activeSessionId}
            onSelect={() => setActiveGroupId(group.id)}
            onNewTerminal={() => onNewTerminal(group.id)}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
          />
        ))}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{groups.length} 个分组</span>
          <span>{tabs.length} 个终端</span>
        </div>
      </div>
    </div>
  );
};

export default TerminalSidebar;
