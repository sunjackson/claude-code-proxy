/**
 * ProjectMemoryDialog Component
 *
 * Dialog for editing project memory/context (CLAUDE.md).
 * Reads and writes CLAUDE.md file in the project directory.
 */

import React from 'react';
import { X, Save, FileText, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

interface ProjectMemoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workDir?: string;
  onSave: (content: string) => void;
}

/**
 * ProjectMemoryDialog - Edit project memory/CLAUDE.md
 */
export const ProjectMemoryDialog: React.FC<ProjectMemoryDialogProps> = ({
  isOpen,
  onClose,
  workDir,
  onSave,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = React.useState('');
  const [originalContent, setOriginalContent] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileExists, setFileExists] = React.useState(false);

  // Load CLAUDE.md content when dialog opens or workDir changes
  React.useEffect(() => {
    if (isOpen && workDir) {
      loadProjectMemory();
    }
  }, [isOpen, workDir]);

  const getClaudeMdPath = () => {
    if (!workDir) return null;
    // Normalize path separators
    const normalizedPath = workDir.replace(/\\/g, '/');
    return `${normalizedPath}/CLAUDE.md`;
  };

  const loadProjectMemory = async () => {
    if (!workDir) return;

    setIsLoading(true);
    setError(null);

    const filePath = getClaudeMdPath();
    if (!filePath) return;

    try {
      const fileContent = await readTextFile(filePath);
      setContent(fileContent);
      setOriginalContent(fileContent);
      setFileExists(true);
    } catch (err: any) {
      console.log('CLAUDE.md not found or cannot be read:', err);
      // File doesn't exist - show template
      const template = `# ${workDir.split('/').pop() || 'Project'} - AI Context

## Project Overview
<!-- Describe what this project does -->

## Tech Stack
<!-- List the main technologies used -->

## Architecture
<!-- Describe the project structure -->

## Coding Conventions
<!-- List any coding standards or conventions -->

## Important Notes
<!-- Add any important context for AI assistance -->
`;
      setContent(template);
      setOriginalContent('');
      setFileExists(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workDir) return;

    const filePath = getClaudeMdPath();
    if (!filePath) return;

    setIsSaving(true);
    setError(null);

    try {
      await writeTextFile(filePath, content);
      setOriginalContent(content);
      setFileExists(true);
      onSave(content);
      onClose();
    } catch (err: any) {
      console.error('Failed to save project memory:', err);
      setError(`${t('terminal.projectMemory.saveFailed')}: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== originalContent;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('terminal.projectMemory.title')}
              </h2>
              {workDir && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {workDir}/CLAUDE.md
                  {!fileExists && (
                    <span className="ml-2 text-yellow-500">(新建)</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadProjectMemory}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <p className="text-sm text-gray-400 mb-4">
            {t('terminal.projectMemory.description')}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">加载中...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 resize-none font-mono leading-relaxed"
                placeholder={t('terminal.projectMemory.placeholder')}
                spellCheck={false}
              />

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>{t('terminal.projectMemory.hint')}</span>
                  {hasChanges && (
                    <span className="text-yellow-500">● 有未保存的更改</span>
                  )}
                </div>
                <span>{content.length} {t('terminal.projectMemory.characters')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <div className="text-xs text-gray-500">
            {fileExists ? '编辑现有文件' : '将创建新文件'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !workDir || isLoading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('common.save')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
