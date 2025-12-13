/**
 * TerminalTabBar Component
 *
 * Tab bar for managing multiple terminal sessions.
 * Shows session name, provider, and allows switching/closing.
 */

import React from 'react';
import { X, Plus, Terminal, ChevronDown } from 'lucide-react';

export interface TerminalTab {
  sessionId: string;
  name: string;
  configId: number;
  configName?: string;
  isRunning: boolean;
}

interface TerminalTabBarProps {
  /** List of terminal tabs */
  tabs: TerminalTab[];
  /** Currently active tab session ID */
  activeSessionId: string | null;
  /** Callback when tab is selected */
  onSelectTab: (sessionId: string) => void;
  /** Callback when tab is closed */
  onCloseTab: (sessionId: string) => void;
  /** Callback when new terminal is requested */
  onNewTerminal: () => void;
  /** Callback when provider switch is requested */
  onSwitchProvider?: (sessionId: string) => void;
}

/**
 * Terminal tab bar component
 */
export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({
  tabs,
  activeSessionId,
  onSelectTab,
  onCloseTab,
  onNewTerminal,
  onSwitchProvider,
}) => {
  return (
    <div className="flex items-center bg-gray-900/50 border-b border-gray-800 overflow-x-auto">
      {/* Tabs */}
      <div className="flex-1 flex items-center min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.sessionId === activeSessionId;
          return (
            <div
              key={tab.sessionId}
              className={`
                group flex items-center gap-2 px-3 py-2 min-w-[140px] max-w-[200px]
                border-r border-gray-800 cursor-pointer transition-colors
                ${
                  isActive
                    ? 'bg-gray-800/80 text-yellow-400'
                    : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
                }
              `}
              onClick={() => onSelectTab(tab.sessionId)}
            >
              {/* Status indicator */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  tab.isRunning ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />

              {/* Tab icon */}
              <Terminal className="w-4 h-4 flex-shrink-0" />

              {/* Tab name */}
              <span className="flex-1 truncate text-sm font-medium">
                {tab.name || `Terminal ${tab.sessionId.slice(-4)}`}
              </span>

              {/* Provider selector - only show on hover */}
              {onSwitchProvider && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwitchProvider(tab.sessionId);
                  }}
                  className={`
                    flex items-center gap-0.5 px-1 py-0.5 rounded text-xs
                    opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0
                    ${
                      isActive
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }
                  `}
                  title={`Switch provider: ${tab.configName || `#${tab.configId}`}`}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.sessionId);
                }}
                className={`
                  p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity
                  ${
                    isActive
                      ? 'hover:bg-yellow-500/20 text-yellow-400'
                      : 'hover:bg-gray-700 text-gray-400'
                  }
                `}
                title="Close terminal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* New terminal button */}
      <button
        onClick={onNewTerminal}
        className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800/50 transition-colors"
        title="New terminal"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New</span>
      </button>
    </div>
  );
};

export default TerminalTabBar;
