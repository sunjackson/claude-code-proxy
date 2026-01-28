/**
 * TerminalWorkspace Page
 *
 * Main terminal workspace with multi-tab support,
 * left sidebar for group management, and right-side drawer for history.
 * 使用 CompactLayout 统一布局框架，与其他页面保持一致的导航体验。
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { RefreshCw, Trash2, PanelRight, ChevronLeft, ChevronRight, Zap, Plus, Terminal, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  TerminalPanel,
  TerminalTabBar,
  TerminalTab,
  NewTerminalDialog,
  ClaudeCodeDialog,
  TerminalSidebar,
  ProjectContextPanel,
} from '../components/terminal';

import {
  createPtySession,
  createClaudeCodeSession,
  closePtySession,
  listPtySessions,
  generateSessionId,
  PtySessionInfo,
  ClaudeCodeOptions,
} from '../api/terminal';

import { listApiConfigs } from '../api/config';
import { ApiConfig } from '../types/tauri';
import { useTerminalStore } from '../store/terminalStore';
import { CompactLayout } from '../components/CompactLayout';
import { useFullscreenResize } from '../hooks/useFullscreenResize';

// Extended tab type with workDir
interface TerminalTabExtended extends TerminalTab {
  workDir?: string;
}

/**
 * Terminal Workspace Page
 */
const TerminalWorkspace: React.FC = () => {
  // Get state and actions from store
  const {
    tabs,
    activeSessionId,
    initialized,
    drawerOpen,
    activeGroupId,
    tabGroupMap,
    setTabs,
    addTab,
    removeTab,
    updateTab,
    setActiveSessionId,
    clearOutputBuffer,
    setInitialized,
    addToHistory,
    setDrawerOpen,
  } = useTerminalStore();

  // Local state for dialogs, configs, and sidebar
  const [isNewDialogOpen, setIsNewDialogOpen] = React.useState(false);
  const [isClaudeCodeDialogOpen, setIsClaudeCodeDialogOpen] = React.useState(false);
  const [newTerminalGroupId, setNewTerminalGroupId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [configs, setConfigs] = React.useState<ApiConfig[]>([]);
  const [isLoading, setIsLoading] = React.useState(!initialized);
  // Store session info with workDir
  const [sessionInfoMap, setSessionInfoMap] = React.useState<Map<string, PtySessionInfo>>(new Map());

  // Load configs and existing sessions on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // 监听全屏变化，强制重新布局
  const [forceResizeKey, setForceResizeKey] = React.useState(0);
  useFullscreenResize(() => {
    // 触发组件重新渲染和终端 resize
    setForceResizeKey((prev) => prev + 1);
  });

  const loadInitialData = async () => {
    // Only show loading if not initialized
    if (!initialized) {
      setIsLoading(true);
    }

    try {
      // Load API configs
      const configList = await listApiConfigs();
      setConfigs(configList.filter((c) => c.is_enabled));

      // Load existing PTY sessions from backend
      const sessions = await listPtySessions();

      // Build session info map
      const infoMap = new Map<string, PtySessionInfo>();
      sessions.forEach((s) => infoMap.set(s.session_id, s));
      setSessionInfoMap(infoMap);

      if (sessions.length > 0) {
        // Sync tabs with backend sessions
        const loadedTabs: TerminalTabExtended[] = sessions.map((s) => ({
          sessionId: s.session_id,
          name: s.name || `Terminal`,
          configId: s.config_id,
          configName: configList.find((c) => c.id === s.config_id)?.name,
          isRunning: s.running,
          isClaudeCode: s.is_claude_code || false,
          workDir: s.work_dir,
        }));

        setTabs(loadedTabs);

        // Set active session if not already set
        if (!activeSessionId && loadedTabs.length > 0) {
          setActiveSessionId(loadedTabs[0].sessionId);
        }
      } else if (tabs.length > 0) {
        // Backend has no sessions but store has tabs - clear stale tabs
        setTabs([]);
        setActiveSessionId(null);
      }

      setInitialized(true);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load terminal data');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new terminal with optional workDir and groupId
  const handleCreateTerminal = useCallback(
    async (configId: number, name?: string, workDir?: string, groupId?: string) => {
      try {
        const sessionId = generateSessionId();
        const session = await createPtySession(sessionId, configId, name, workDir);

        const config = configs.find((c) => c.id === configId);
        const newTab: TerminalTabExtended = {
          sessionId: session.session_id,
          name: session.name || `Terminal`,
          configId: session.config_id,
          configName: config?.name,
          isRunning: true,
          isClaudeCode: false,
          workDir: session.work_dir,
        };

        // Update session info map
        setSessionInfoMap((prev) => {
          const next = new Map(prev);
          next.set(session.session_id, session);
          return next;
        });

        // Add tab to specified group or active group
        addTab(newTab, groupId || activeGroupId);
        setActiveSessionId(session.session_id);
        toast.success('Terminal created');
      } catch (error) {
        console.error('Failed to create terminal:', error);
        toast.error(`Failed to create terminal: ${error}`);
      }
    },
    [configs, addTab, setActiveSessionId, activeGroupId]
  );

  // Create new Claude Code terminal
  const handleCreateClaudeCode = useCallback(
    async (
      configId: number,
      workDir: string,
      claudeOptions: ClaudeCodeOptions,
      name?: string,
      groupId?: string
    ) => {
      try {
        const sessionId = generateSessionId();
        const session = await createClaudeCodeSession(
          sessionId,
          configId,
          workDir,
          claudeOptions,
          name
        );

        const config = configs.find((c) => c.id === configId);
        const newTab: TerminalTabExtended = {
          sessionId: session.session_id,
          name: session.name || name || 'Claude Code',
          configId: session.config_id,
          configName: config?.name,
          isRunning: true,
          isClaudeCode: true,
          workDir: session.work_dir,
        };

        // Update session info map
        setSessionInfoMap((prev) => {
          const next = new Map(prev);
          next.set(session.session_id, session);
          return next;
        });

        // Add tab to specified group or active group
        addTab(newTab, groupId || activeGroupId);
        setActiveSessionId(session.session_id);
        toast.success('Claude Code session created');
      } catch (error) {
        console.error('Failed to create Claude Code session:', error);
        toast.error(`Failed to create Claude Code session: ${error}`);
      }
    },
    [configs, addTab, setActiveSessionId, activeGroupId]
  );

  // Close terminal and save to history
  const handleCloseTab = useCallback(
    async (sessionId: string) => {
      // Find tab info before closing
      const tab = tabs.find((t) => t.sessionId === sessionId) as TerminalTabExtended | undefined;
      const sessionInfo = sessionInfoMap.get(sessionId);

      try {
        await closePtySession(sessionId);

        // Add to history with workDir
        if (tab) {
          addToHistory({
            sessionId: tab.sessionId,
            name: tab.name,
            configId: tab.configId,
            configName: tab.configName,
            createdAt: new Date().toISOString(),
            closedAt: new Date().toISOString(),
            workDir: sessionInfo?.work_dir || tab.workDir,
            exitedNormally: true,
          });
        }

        // Clean up session info map
        setSessionInfoMap((prev) => {
          const next = new Map(prev);
          next.delete(sessionId);
          return next;
        });

        clearOutputBuffer(sessionId);
        removeTab(sessionId);
      } catch (error) {
        console.error('Failed to close terminal:', error);
        toast.error(`Failed to close terminal: ${error}`);
      }
    },
    [tabs, sessionInfoMap, clearOutputBuffer, removeTab, addToHistory]
  );

  // Handle terminal close event (from PTY)
  const handleTerminalClose = useCallback(
    (sessionId: string) => {
      const tab = tabs.find((t) => t.sessionId === sessionId) as TerminalTabExtended | undefined;
      const sessionInfo = sessionInfoMap.get(sessionId);
      updateTab(sessionId, { isRunning: false });

      // Add to history when session ends unexpectedly
      if (tab) {
        addToHistory({
          sessionId: tab.sessionId,
          name: tab.name,
          configId: tab.configId,
          configName: tab.configName,
          createdAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
          workDir: sessionInfo?.work_dir || tab.workDir,
          exitedNormally: false,
        });
      }
    },
    [tabs, sessionInfoMap, updateTab, addToHistory]
  );

  // Clear all terminals
  const handleClearAll = useCallback(async () => {
    if (!confirm('Close all terminals?')) return;

    try {
      for (const tab of tabs) {
        const extTab = tab as TerminalTabExtended;
        const sessionInfo = sessionInfoMap.get(tab.sessionId);

        await closePtySession(tab.sessionId);
        clearOutputBuffer(tab.sessionId);

        // Add each to history with workDir
        addToHistory({
          sessionId: tab.sessionId,
          name: tab.name,
          configId: tab.configId,
          configName: tab.configName,
          createdAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
          workDir: sessionInfo?.work_dir || extTab.workDir,
          exitedNormally: true,
        });
      }
      setSessionInfoMap(new Map());
      setTabs([]);
      setActiveSessionId(null);
      toast.success('All terminals closed');
    } catch (error) {
      console.error('Failed to clear terminals:', error);
      toast.error(`Failed to clear terminals: ${error}`);
    }
  }, [tabs, sessionInfoMap, clearOutputBuffer, setTabs, setActiveSessionId, addToHistory]);

  // Get tabs for current active group
  const currentGroupTabs = useMemo(() => {
    return tabs.filter(
      (t) => (tabGroupMap[t.sessionId] || 'default') === activeGroupId
    );
  }, [tabs, tabGroupMap, activeGroupId]);

  // Handle new terminal from sidebar (with specific group)
  const handleNewTerminalForGroup = useCallback((groupId: string) => {
    setNewTerminalGroupId(groupId);
    setIsNewDialogOpen(true);
  }, []);

  // Get current session info - defined before handlers that use it
  const currentSessionInfo = React.useMemo(() => {
    if (!activeSessionId) return null;
    return sessionInfoMap.get(activeSessionId);
  }, [activeSessionId, sessionInfoMap]);

  return (
    <CompactLayout>
      {/* 终端工作区内容 - 使用负边距抵消 CompactLayout 的 padding，全屏自适应 */}
      <div className="-mx-6 -mt-6 -mb-6 flex flex-col h-[calc(100vh-52px)]">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {tabs.length} 个终端
            </span>
            <div className="w-px h-4 bg-gray-700" />
            <button
              onClick={() => setIsClaudeCodeDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors"
              title="启动 Claude Code"
            >
              <Zap className="w-4 h-4" />
              <span>Claude Code</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadInitialData()}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {tabs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                title="关闭所有终端"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar with collapse toggle */}
        <div className="flex flex-shrink-0">
          {/* Sidebar content */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              sidebarOpen ? 'w-56' : 'w-0'
            }`}
          >
            {sidebarOpen && (
              <TerminalSidebar
                onNewTerminal={handleNewTerminalForGroup}
                onSelectTab={setActiveSessionId}
                onCloseTab={handleCloseTab}
              />
            )}
          </div>

          {/* Collapse toggle bar */}
          <div
            className="w-5 flex-shrink-0 bg-gray-900/30 border-r border-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-800/50 transition-colors group"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? '收起分组面板' : '展开分组面板'}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
            )}
          </div>
        </div>

        {/* Terminal content area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab bar - shows tabs for current group */}
          <TerminalTabBar
            tabs={currentGroupTabs}
            activeSessionId={activeSessionId}
            onSelectTab={setActiveSessionId}
            onCloseTab={handleCloseTab}
            onNewTerminal={() => setIsNewDialogOpen(true)}
          />

          {/* Terminal area - 使用 flex-1 和 min-h-0 确保自适应 */}
          <div className="flex-1 p-4 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">加载终端中...</p>
                </div>
              </div>
            ) : currentGroupTabs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-800/50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    当前分组无终端
                  </h2>
                  <p className="text-gray-400 mb-6">
                    在此分组中创建新终端开始使用
                  </p>
                  <button
                    onClick={() => setIsNewDialogOpen(true)}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors"
                  >
                    创建终端
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full rounded-lg overflow-hidden border border-gray-800" key={forceResizeKey}>
                {tabs.map((tab) => {
                  const sessionInfo = sessionInfoMap.get(tab.sessionId);
                  return (
                    <TerminalPanel
                      key={tab.sessionId}
                      sessionId={tab.sessionId}
                      isActive={tab.sessionId === activeSessionId}
                      isClaudeCode={sessionInfo?.is_claude_code || false}
                      onClose={() => handleTerminalClose(tab.sessionId)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar (Project Info Panel) with collapse toggle */}
        <div className="flex flex-shrink-0">
          {/* Collapse toggle bar */}
          <div
            className="w-5 flex-shrink-0 bg-gray-900/30 border-l border-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-800/50 transition-colors group"
            onClick={() => setDrawerOpen(!drawerOpen)}
            title={drawerOpen ? '收起项目信息面板' : '展开项目信息面板'}
          >
            {drawerOpen ? (
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
            )}
          </div>

          {/* Right sidebar content */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              drawerOpen ? 'w-72' : 'w-0'
            }`}
          >
            {drawerOpen && (
              <div className="w-72 h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
                {/* Inline drawer header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <PanelRight className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">项目信息</span>
                  </div>
                </div>

                {/* Drawer content - scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {/* Quick Actions */}
                  <div className="p-3 border-b border-gray-800">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      快速操作
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setIsNewDialogOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-2 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="font-medium">新建终端</span>
                      </button>
                      <button
                        onClick={handleClearAll}
                        disabled={tabs.length === 0}
                        className="flex items-center gap-1.5 px-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:text-gray-600 disabled:hover:bg-gray-800 rounded-lg transition-colors text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="font-medium">关闭全部</span>
                      </button>
                    </div>
                  </div>

                  {/* Current Session Info */}
                  <div className="p-3 border-b border-gray-800">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      当前会话
                    </h3>
                    {activeSessionId && currentSessionInfo ? (
                      <div className="space-y-2">
                        <div className="bg-gray-800/50 rounded-lg p-2">
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <Terminal className="w-3.5 h-3.5" />
                            <span className="text-xs">会话名称</span>
                          </div>
                          <span className="text-sm text-white truncate block">
                            {currentSessionInfo.name || '未命名'}
                          </span>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-2">
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span className="text-xs">工作目录</span>
                          </div>
                          <span className="text-sm text-white truncate block" title={currentSessionInfo.work_dir}>
                            {currentSessionInfo.work_dir || '未设置'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-500">无活动会话</p>
                      </div>
                    )}
                  </div>

                  {/* Project Context Info - Memories, Commands, CLAUDE.md */}
                  {currentSessionInfo?.work_dir && (
                    <ProjectContextPanel
                      projectPath={currentSessionInfo.work_dir}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New terminal dialog */}
      <NewTerminalDialog
        isOpen={isNewDialogOpen}
        onClose={() => {
          setIsNewDialogOpen(false);
          setNewTerminalGroupId(null);
        }}
        onCreate={(configId, name) => {
          handleCreateTerminal(configId, name, undefined, newTerminalGroupId || undefined);
          setNewTerminalGroupId(null);
        }}
        defaultConfigId={configs[0]?.id}
      />

      {/* Claude Code dialog */}
      <ClaudeCodeDialog
        isOpen={isClaudeCodeDialogOpen}
        onClose={() => setIsClaudeCodeDialogOpen(false)}
        onCreate={(configId, workDir, claudeOptions, name) => {
          handleCreateClaudeCode(configId, workDir, claudeOptions, name, newTerminalGroupId || undefined);
          setNewTerminalGroupId(null);
        }}
        defaultConfigId={configs[0]?.id}
      />
      </div>
    </CompactLayout>
  );
};

export default TerminalWorkspace;
