/**
 * ProjectPathDialog Component
 *
 * Dialog for editing terminal session's working directory.
 */

import React from 'react';
import { X, FolderOpen, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';

interface ProjectPathDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  onSave: (newPath: string) => void;
}

/**
 * ProjectPathDialog - Edit terminal working directory
 */
export const ProjectPathDialog: React.FC<ProjectPathDialogProps> = ({
  isOpen,
  onClose,
  currentPath,
  onSave,
}) => {
  const { t } = useTranslation();
  const [path, setPath] = React.useState(currentPath || '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPath(currentPath || '');
      setError(null);
    }
  }, [isOpen, currentPath]);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: path || undefined,
      });

      if (selected && typeof selected === 'string') {
        setPath(selected);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to browse directory:', err);
      setError(t('terminal.projectPath.browseFailed'));
    }
  };

  const handleSave = () => {
    if (!path.trim()) {
      setError(t('terminal.projectPath.pathRequired'));
      return;
    }

    onSave(path.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">
              {t('terminal.projectPath.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-400 mb-4">
            {t('terminal.projectPath.description')}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {t('terminal.projectPath.workingDirectory')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setError(null);
                }}
                placeholder="/path/to/your/project"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                {t('claudeCode.browse')}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {t('terminal.projectPath.hint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
