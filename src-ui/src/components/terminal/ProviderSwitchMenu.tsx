/**
 * ProviderSwitchMenu Component
 *
 * Dropdown menu for switching terminal provider at runtime.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { ApiConfig } from '../../types/tauri';
import { listApiConfigs } from '../../api/config';

interface ProviderSwitchMenuProps {
  /** Current config ID */
  currentConfigId: number;
  /** Position for the menu */
  position: { x: number; y: number };
  /** Callback when provider is selected */
  onSelect: (configId: number) => void;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Dropdown menu for switching providers
 */
export const ProviderSwitchMenu: React.FC<ProviderSwitchMenuProps> = ({
  currentConfigId,
  position,
  onSelect,
  onClose,
}) => {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load configs
  useEffect(() => {
    loadConfigs();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadConfigs = async () => {
    try {
      const result = await listApiConfigs();
      setConfigs(result.filter((c) => c.is_enabled));
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (configId: number) => {
    if (configId !== currentConfigId) {
      onSelect(configId);
    }
    onClose();
  };

  // Calculate position to stay within viewport
  const getAdjustedPosition = () => {
    const menuWidth = 250;
    const menuHeight = 300;
    let { x, y } = position;

    // Adjust if menu would overflow right
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    // Adjust if menu would overflow bottom
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    return { left: x, top: y };
  };

  const adjustedPosition = getAdjustedPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{
        left: adjustedPosition.left,
        top: adjustedPosition.top,
        width: 250,
        maxHeight: 300,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700">
        <div className="text-sm font-medium text-gray-300">切换服务商</div>
        <div className="text-xs text-gray-500">
          完全静默切换，无终端干扰
        </div>
      </div>

      {/* Provider list */}
      <div className="overflow-y-auto" style={{ maxHeight: 250 }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : configs.length === 0 ? (
          <div className="px-3 py-6 text-center text-gray-500 text-sm">
            暂无可用服务商
          </div>
        ) : (
          <div className="py-1">
            {configs.map((config) => {
              const isCurrent = config.id === currentConfigId;
              return (
                <button
                  key={config.id}
                  onClick={() => handleSelect(config.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                    ${
                      isCurrent
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCurrent ? 'bg-yellow-500' : ''
                    }`}
                  >
                    {isCurrent && <Check className="w-3 h-3 text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {config.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {config.server_url}
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-xs text-yellow-500 flex-shrink-0">
                      当前
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderSwitchMenu;
