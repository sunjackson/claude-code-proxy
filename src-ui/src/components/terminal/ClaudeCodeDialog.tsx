/**
 * ClaudeCodeDialog Component
 *
 * Dialog for creating a new Claude Code terminal session with project directory
 * selection and startup options.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FolderOpen,
  Check,
  Zap,
  RefreshCw,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { ApiConfig } from '../../types/tauri';
import { listApiConfigs } from '../../api/config';
import { ClaudeCodeOptions } from '../../api/terminal';
import { useTranslation } from 'react-i18next';

interface ClaudeCodeDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when terminal is created */
  onCreate: (
    configId: number,
    workDir: string,
    claudeOptions: ClaudeCodeOptions,
    name?: string
  ) => void;
  /** Default config ID to select */
  defaultConfigId?: number;
  /** Default project directory */
  defaultWorkDir?: string;
}

/**
 * Dialog for creating Claude Code terminal session
 */
export const ClaudeCodeDialog: React.FC<ClaudeCodeDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultConfigId,
  defaultWorkDir,
}) => {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(
    defaultConfigId ?? null
  );
  const [workDir, setWorkDir] = useState(defaultWorkDir || '');
  const [terminalName, setTerminalName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Claude Code options
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [resumeSession, setResumeSession] = useState(false);
  const [continueMode, setContinueMode] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');

  // Load API configs (separate from form reset to avoid circular dependency)
  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listApiConfigs();
      const enabledConfigs = result.filter((c) => c.is_enabled);
      setConfigs(enabledConfigs);

      // Set default selection only if not already selected
      if (defaultConfigId && enabledConfigs.some((c) => c.id === defaultConfigId)) {
        setSelectedConfigId(defaultConfigId);
      } else if (enabledConfigs.length > 0) {
        // Only set first config as default if no selection exists
        setSelectedConfigId((prev) => prev ?? enabledConfigs[0].id);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [defaultConfigId]);

  // Load API configs and reset form when dialog opens
  // Important: Only trigger on isOpen change, not on loadConfigs change
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      // Reset form state (only once when dialog opens)
      setWorkDir(defaultWorkDir || '');
      setTerminalName('');
      setSkipPermissions(false);
      setResumeSession(false);
      setContinueMode(false);
      setCustomModel('');
      setInitialPrompt('');
      setShowAdvanced(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultWorkDir]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('claudeCode.selectProjectDir', '选择项目目录'),
      });
      if (selected && typeof selected === 'string') {
        setWorkDir(selected);
        // Auto-generate terminal name from directory
        if (!terminalName) {
          const dirName = selected.split(/[\\/]/).pop() || 'Claude Code';
          setTerminalName(dirName);
        }
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleCreate = () => {
    if (selectedConfigId !== null && workDir) {
      const options: ClaudeCodeOptions = {
        skip_permissions: skipPermissions,
        resume: resumeSession,
        continue_mode: continueMode,
        model: customModel || undefined,
        initial_prompt: initialPrompt || undefined,
        extra_args: [],
      };
      onCreate(selectedConfigId, workDir, options, terminalName || undefined);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedConfigId !== null && workDir) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const canCreate = selectedConfigId !== null && workDir;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('claudeCode.newSession', '新建 Claude Code 会话')}
              </h2>
              <p className="text-sm text-gray-400">
                {t('claudeCode.selectProjectAndOptions', '选择项目目录和启动选项')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Project directory selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('claudeCode.projectDir', '项目目录')} <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                placeholder={t('claudeCode.projectDirPlaceholder', '/path/to/your/project')}
                className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm"
              />
              <button
                onClick={handleSelectDirectory}
                className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-600 transition-colors"
                title={t('claudeCode.browse', '浏览')}
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {t('claudeCode.projectDirHint', 'Claude Code 将在此目录中运行')}
            </p>
          </div>

          {/* Terminal name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('claudeCode.sessionName', '会话名称')} <span className="text-gray-500">({t('common.optional', '可选')})</span>
            </label>
            <input
              type="text"
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              placeholder={t('claudeCode.sessionNamePlaceholder', '例如: my-project')}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm"
            />
          </div>

          {/* Startup options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {t('claudeCode.startupOptions', '启动选项')}
            </label>

            {/* Quick options */}
            <div className="grid grid-cols-2 gap-3">
              {/* Skip permissions */}
              <label className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={skipPermissions}
                  onChange={(e) => setSkipPermissions(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {t('claudeCode.skipPermissions', '跳过权限')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    --dangerously-skip-permissions
                  </p>
                </div>
              </label>

              {/* Resume session */}
              <label className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={resumeSession}
                  onChange={(e) => setResumeSession(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {t('claudeCode.resumeSession', '恢复会话')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">-r / --resume</p>
                </div>
              </label>

              {/* Continue mode */}
              <label className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={continueMode}
                  onChange={(e) => setContinueMode(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <TerminalIcon className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {t('claudeCode.continueMode', '继续模式')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">-c / --continue</p>
                </div>
              </label>
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            <span>{t('claudeCode.advancedOptions', '高级选项')}</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              {/* Custom model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('claudeCode.customModel', '自定义模型')}
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={t('claudeCode.customModelPlaceholder', '例如: claude-sonnet-4-20250514')}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {t('claudeCode.customModelHint', '留空使用默认模型')}
                </p>
              </div>

              {/* Initial prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('claudeCode.initialPrompt', '初始提示词')}
                </label>
                <textarea
                  value={initialPrompt}
                  onChange={(e) => setInitialPrompt(e.target.value)}
                  placeholder={t('claudeCode.initialPromptPlaceholder', '启动后立即发送的提示词...')}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Provider selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('claudeCode.serviceProvider', '服务商')}
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-6 text-gray-400 bg-gray-800/50 rounded-lg border border-gray-700">
                <p>{t('claudeCode.noConfigs', '暂无可用配置')}</p>
                <p className="text-sm mt-1">
                  {t('claudeCode.addConfigHint', '请先在设置中添加并启用服务商配置')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {configs.map((config) => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfigId(config.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${
                        selectedConfigId === config.id
                          ? 'bg-orange-500/10 border-orange-500/50 text-white'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                      }
                    `}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedConfigId === config.id
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-gray-600'
                      }`}
                    >
                      {selectedConfigId === config.id && (
                        <Check className="w-2.5 h-2.5 text-black" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{config.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {config.server_url}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm"
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-black font-medium rounded-lg transition-all text-sm flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {t('claudeCode.startClaude', '启动 Claude Code')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaudeCodeDialog;
