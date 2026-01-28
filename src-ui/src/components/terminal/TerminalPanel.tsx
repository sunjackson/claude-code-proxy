/**
 * TerminalPanel Component
 *
 * xterm.js based terminal panel for a single PTY session.
 * Handles terminal rendering, input/output, resize, and image paste.
 * Persists output to store for recovery after page navigation.
 *
 * Optimizations (v1.2.2):
 * - Improved scroll handling to prevent disruption when user scrolls up
 * - Removed harmful output regex processing that broke ANSI sequences
 * - Better terminal configuration for stability
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

import {
  ptyWriteInput,
  ptyResize,
  encodeInput,
  decodeOutput,
  TerminalOutputEvent,
  TerminalClosedEvent,
  TerminalErrorEvent,
} from '../../api/terminal';
import { useTerminalStore } from '../../store/terminalStore';

interface TerminalPanelProps {
  /** Session ID for this terminal */
  sessionId: string;
  /** Whether this terminal is currently active/visible */
  isActive?: boolean;
  /** Whether this is a Claude Code session */
  isClaudeCode?: boolean;
  /** Callback when terminal closes */
  onClose?: () => void;
  /** Callback when terminal errors */
  onError?: (error: string) => void;
}

/**
 * Convert a File/Blob to base64 string
 */
async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Terminal panel component using xterm.js
 */
export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  sessionId,
  isActive = true,
  isClaudeCode: _isClaudeCode = false, // Kept for API compatibility, no longer used for output processing
  onClose,
  onError,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Improved scroll tracking - track if user is actively scrolling/viewing history
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get store methods
  const { appendOutput, getOutputBuffer } = useTerminalStore();

  // Use ref for isActive to avoid stale closure issues
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Store callbacks in refs to avoid dependency changes
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  }, [onClose, onError]);

  // Drag state for visual feedback
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Check if terminal is scrolled to bottom
   */
  const isAtBottom = useCallback(() => {
    if (!xtermRef.current) return true;
    const term = xtermRef.current;
    const buffer = term.buffer.active;
    // Consider "at bottom" if within 3 lines of the end
    return buffer.baseY + term.rows >= buffer.length - 3;
  }, []);

  /**
   * Handle user scroll - mark as scrolling if moved away from bottom
   */
  const handleUserScroll = useCallback(() => {
    // Clear any existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = null;
    }

    // Check if user scrolled away from bottom
    if (!isAtBottom()) {
      isUserScrollingRef.current = true;
      // Keep user scrolling state for 60 seconds (give user time to read history)
      userScrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 60000);
    } else {
      // User scrolled back to bottom, resume auto-scroll
      isUserScrollingRef.current = false;
    }
  }, [isAtBottom]);

  /**
   * Process an image file and send to PTY via iTerm2 protocol
   */
  const processImageFile = useCallback(async (file: File, source: 'paste' | 'drop') => {
    if (!xtermRef.current) return;

    try {
      // Convert image to base64
      const base64Data = await fileToBase64(file);

      // Get image type (png, jpeg, etc.)
      const imageType = file.type.split('/')[1] || 'png';
      const fileName = file.name || `${source}-image.${imageType}`;

      // Create the escape sequence for image
      // Using iTerm2 inline image protocol (OSC 1337)
      // Format: ESC ] 1337 ; File=inline=1;size=<size>;name=<filename>:<base64data> BEL
      const imageMarker = `\x1b]1337;File=inline=1;size=${file.size};name=${fileName}:${base64Data}\x07`;

      // Send to PTY
      await ptyWriteInput(sessionId, encodeInput(imageMarker));

      // Show feedback in terminal
      const sourceLabel = source === 'paste' ? 'pasted' : 'dropped';
      const feedback = `\r\n\x1b[33m[Image ${sourceLabel}: ${fileName} (${file.size} bytes)]\x1b[0m\r\n`;
      xtermRef.current.write(feedback);
      appendOutput(sessionId, feedback);

    } catch (error) {
      console.error(`Failed to process ${source} image:`, error);
      const errorMsg = `\r\n\x1b[31m[Failed to process image: ${error}]\x1b[0m\r\n`;
      xtermRef.current?.write(errorMsg);
    }
  }, [sessionId, appendOutput]);

  // Handle paste event for images
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!isActiveRef.current || !xtermRef.current) return;

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // Check for image files in clipboard
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if it's an image
      if (item.type.startsWith('image/')) {
        event.preventDefault(); // Prevent default paste behavior

        const file = item.getAsFile();
        if (!file) continue;

        await processImageFile(file, 'paste');
        return; // Only handle first image
      }
    }

    // For text paste, let xterm.js handle it normally
  }, [processImageFile]);

  // Handle drag over event
  const handleDragOver = useCallback((event: DragEvent) => {
    if (!isActiveRef.current) return;

    // Check if dragged items contain images
    const hasImage = event.dataTransfer?.types.includes('Files') &&
      Array.from(event.dataTransfer?.items || []).some(item => item.type.startsWith('image/'));

    if (hasImage) {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDragging(true);
    }
  }, []);

  // Handle drag leave event
  const handleDragLeave = useCallback((event: DragEvent) => {
    // Only set dragging to false if we're leaving the container entirely
    const relatedTarget = event.relatedTarget as Node | null;
    if (!terminalRef.current?.contains(relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  // Handle drop event for images
  const handleDrop = useCallback(async (event: DragEvent) => {
    if (!isActiveRef.current || !xtermRef.current) return;

    setIsDragging(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Process all image files
    let processedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check if it's an image
      if (file.type.startsWith('image/')) {
        event.preventDefault();
        event.stopPropagation();

        await processImageFile(file, 'drop');
        processedCount++;
      }
    }

    // Show summary if multiple images were dropped
    if (processedCount > 1) {
      const summary = `\r\n\x1b[33m[Total: ${processedCount} images dropped]\x1b[0m\r\n`;
      xtermRef.current.write(summary);
      appendOutput(sessionId, summary);
    }
  }, [processImageFile, sessionId, appendOutput]);

  // Initialize terminal and set up event listeners
  useEffect(() => {
    if (!terminalRef.current) return;

    // Prevent double initialization
    if (xtermRef.current) return;

    let isMounted = true;
    let unlistenOutput: UnlistenFn | undefined;
    let unlistenClosed: UnlistenFn | undefined;
    let unlistenError: UnlistenFn | undefined;

    const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
    const isWindows = /Win/i.test(platform);
    const isMac = /Mac/i.test(platform);

    // Create terminal instance with optimized configuration
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily:
        '"MesloLGS NF", "Cascadia Mono", "Cascadia Code", Consolas, Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      allowProposedApi: true,
      scrollback: 10000,
      // Improved scroll behavior
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1, // Reduced for smoother scrolling
      smoothScrollDuration: 0, // Disable smooth scroll for responsiveness
      // Performance and rendering
      windowsMode: isWindows,
      macOptionIsMeta: isMac,
      // Let PTY handle EOL conversion
      convertEol: false,
      // Improved rendering options
      minimumContrastRatio: 1,
      tabStopWidth: 4,
      altClickMovesCursor: true,
      // Scroll behavior
      scrollOnUserInput: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#d4af37',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#d4af3744',
        selectionForeground: '#ffffff',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add Unicode11 addon for proper CJK and emoji support
    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';

    // Add web links addon
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Note: Image addon is not available in current xterm.js npm packages
    // Image paste functionality is handled via iTerm2 protocol sent to PTY
    // Claude Code CLI will receive and process the image data

    // Open terminal
    term.open(terminalRef.current);
    xtermRef.current = term;

    // Restore previous output from store (if any)
    const previousOutput = getOutputBuffer(sessionId);
    if (previousOutput) {
      // Reset terminal state before restoring to ensure clean state
      term.reset();
      // Write the restored content
      term.write(previousOutput);
      // Scroll to bottom after restoring output
      term.scrollToBottom();
    }

    // Fit to container after a short delay and scroll to bottom
    setTimeout(() => {
      if (isMounted && fitAddon) {
        fitAddon.fit();
        setIsReady(true);
        // Ensure we're at the bottom after fit
        term.scrollToBottom();
      }
    }, 100);

    // Handle user input - only when active
    // User input resets scroll state (user wants to interact, so resume auto-scroll)
    const inputHandler = term.onData(async (data) => {
      if (!isMounted || !isActiveRef.current) return;
      // User input means they want to interact - reset scroll state
      isUserScrollingRef.current = false;
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
        userScrollTimeoutRef.current = null;
      }
      try {
        await ptyWriteInput(sessionId, encodeInput(data));
      } catch (error) {
        console.error('Failed to send input:', error);
      }
    });

    // Handle scroll events - track user scrolling behavior
    const scrollHandler = term.onScroll(() => {
      handleUserScroll();
    });

    // Set up event listeners for PTY output
    const setupListeners = async () => {
      if (!isMounted) return;

      // Terminal output
      unlistenOutput = await listen<TerminalOutputEvent>(
        'terminal:output',
        (event) => {
          if (!isMounted) return;
          if (event.payload.session_id === sessionId && xtermRef.current) {
            // Decode the output - DO NOT process/modify the text
            // ANSI escape sequences must be preserved for proper terminal rendering
            const text = decodeOutput(event.payload.data);

            // Write to terminal
            xtermRef.current.write(text);

            // Save to store for persistence
            appendOutput(sessionId, text);

            // Auto-scroll to bottom ONLY if user is not actively viewing history
            if (!isUserScrollingRef.current) {
              xtermRef.current.scrollToBottom();
            }
          }
        }
      );

      // Terminal closed
      unlistenClosed = await listen<TerminalClosedEvent>(
        'terminal:closed',
        (event) => {
          if (!isMounted) return;
          if (event.payload.session_id === sessionId) {
            const msg = '\r\n\x1b[33m[Session ended]\x1b[0m\r\n';
            xtermRef.current?.write(msg);
            appendOutput(sessionId, msg);
            onCloseRef.current?.();
          }
        }
      );

      // Terminal error
      unlistenError = await listen<TerminalErrorEvent>(
        'terminal:error',
        (event) => {
          if (!isMounted) return;
          if (event.payload.session_id === sessionId) {
            const msg = `\r\n\x1b[31m[Error: ${event.payload.error}]\x1b[0m\r\n`;
            xtermRef.current?.write(msg);
            appendOutput(sessionId, msg);
            onErrorRef.current?.(event.payload.error);
          }
        }
      );
    };

    setupListeners();

    // Cleanup function - only dispose xterm, keep store data
    return () => {
      isMounted = false;
      inputHandler.dispose();
      scrollHandler.dispose();
      unlistenOutput?.();
      unlistenClosed?.();
      unlistenError?.();
      // Clear user scroll timeout
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
        userScrollTimeoutRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, appendOutput, getOutputBuffer, handleUserScroll]); // Only re-run if sessionId changes

  // Set up paste and drag-drop event listeners
  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    // Add paste event listener to the terminal container
    container.addEventListener('paste', handlePaste);

    // Add drag-drop event listeners for image drop support
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('paste', handlePaste);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, [handlePaste, handleDragOver, handleDragLeave, handleDrop]);

  // Handle resize - sync with PTY backend
  const handleResize = useCallback(async () => {
    if (fitAddonRef.current && xtermRef.current && isActive) {
      fitAddonRef.current.fit();

      // Sync dimensions with PTY backend
      const term = xtermRef.current;
      const rows = term.rows;
      const cols = term.cols;

      if (rows > 0 && cols > 0) {
        try {
          await ptyResize(sessionId, rows, cols);
        } catch (error) {
          console.error('Failed to resize PTY:', error);
        }
      }
    }
  }, [isActive, sessionId]);

  // Resize observer - 优化全屏自适应
  useEffect(() => {
    if (!terminalRef.current) return;

    let resizeTimer: NodeJS.Timeout | null = null;

    // 防抖优化：避免频繁触发 resize
    const debouncedResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        handleResize();
      }, 150); // 150ms 防抖延迟
    };

    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(terminalRef.current);

    // 监听窗口 resize 和全屏事件
    window.addEventListener('resize', debouncedResize);
    document.addEventListener('fullscreenchange', debouncedResize);
    document.addEventListener('webkitfullscreenchange', debouncedResize);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('fullscreenchange', debouncedResize);
      document.removeEventListener('webkitfullscreenchange', debouncedResize);
    };
  }, [handleResize]);

  // Focus terminal when active and sync size
  useEffect(() => {
    if (isActive && xtermRef.current && isReady) {
      xtermRef.current.focus();
      // Trigger resize to sync dimensions
      handleResize();
      // Scroll to bottom when terminal becomes active
      setTimeout(() => {
        xtermRef.current?.scrollToBottom();
      }, 50);
    }
  }, [isActive, isReady, handleResize]);

  return (
    <div className="relative h-full w-full" style={{ display: isActive ? 'block' : 'none' }}>
      {/* Terminal container */}
      <div
        ref={terminalRef}
        className={`h-full w-full bg-[#0a0a0a] rounded-lg overflow-hidden transition-opacity ${
          isDragging ? 'opacity-50' : ''
        }`}
      />
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-500/10 border-2 border-dashed border-yellow-500 rounded-lg pointer-events-none">
          <div className="text-yellow-400 text-lg font-medium flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            拖放图片到此处
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalPanel;
