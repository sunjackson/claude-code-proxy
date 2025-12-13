/**
 * NewTerminalDialog Component
 *
 * Dialog for creating a new terminal session with provider selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Terminal, Check } from 'lucide-react';
import { ApiConfig } from '../../types/tauri';
import { listApiConfigs } from '../../api/config';

interface NewTerminalDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when terminal is created */
  onCreate: (configId: number, name?: string) => void;
  /** Default config ID to select */
  defaultConfigId?: number;
}

/**
 * Dialog for creating new terminal session
 */
export const NewTerminalDialog: React.FC<NewTerminalDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultConfigId,
}) => {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(
    defaultConfigId ?? null
  );
  const [terminalName, setTerminalName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listApiConfigs();
      const enabledConfigs = result.filter((c) => c.is_enabled);
      setConfigs(enabledConfigs);

      // Set default selection
      if (defaultConfigId && enabledConfigs.some((c) => c.id === defaultConfigId)) {
        setSelectedConfigId(defaultConfigId);
      } else if (enabledConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(enabledConfigs[0].id);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [defaultConfigId, selectedConfigId]);

  // Load API configs
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, loadConfigs]);

  const handleCreate = () => {
    if (selectedConfigId !== null) {
      onCreate(selectedConfigId, terminalName || undefined);
      setTerminalName('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedConfigId !== null) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">New Terminal</h2>
              <p className="text-sm text-gray-400">Select a provider for this session</p>
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
        <div className="p-5 space-y-4">
          {/* Terminal name input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Terminal Name (optional)
            </label>
            <input
              type="text"
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              placeholder="My Terminal"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
              autoFocus
            />
          </div>

          {/* Provider selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Service Provider
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No enabled configurations found.</p>
                <p className="text-sm mt-1">
                  Please add and enable a provider in Settings.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {configs.map((config) => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfigId(config.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
                      ${
                        selectedConfigId === config.id
                          ? 'bg-yellow-500/10 border-yellow-500/50 text-white'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                      }
                    `}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedConfigId === config.id
                          ? 'border-yellow-500 bg-yellow-500'
                          : 'border-gray-600'
                      }`}
                    >
                      {selectedConfigId === config.id && (
                        <Check className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-gray-500 truncate">
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
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedConfigId === null}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-medium rounded-lg transition-colors"
          >
            Create Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTerminalDialog;
