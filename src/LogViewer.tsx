import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, FileText } from 'lucide-react';
import { logger, LogEntry } from './logger';

interface LogViewerProps {
  onClose: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load initial logs
    setLogs(logger.getLogs());

    // Subscribe to updates
    const unsubscribe = logger.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return unsubscribe;
  }, []);

  const handleDownload = () => {
    logger.downloadLogs();
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      logger.clearLogs();
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'request':
        return 'bg-blue-500/20 border-blue-500';
      case 'response':
        return 'bg-green-500/20 border-green-500';
      case 'error':
        return 'bg-red-500/20 border-red-500';
      default:
        return 'bg-gray-500/20 border-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">API Logs</h2>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
              title="Download logs as JSON"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
              title="Clear all logs"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-white/30 mx-auto mb-3" />
              <p className="text-white/50">No logs yet. Start interacting with Gemini to see logs here.</p>
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${getLogColor(log.type)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-white/20 rounded text-xs font-semibold text-white uppercase">
                      {log.type}
                    </span>
                    {log.hasImage && (
                      <span className="px-2 py-1 bg-purple-500/30 rounded text-xs font-semibold text-white">
                        📸 Image
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/70">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                {log.prompt && (
                  <div className="mb-2">
                    <p className="text-xs text-white/70 mb-1">Prompt:</p>
                    <p className="text-white text-sm bg-black/20 rounded p-2">
                      {log.prompt}
                    </p>
                  </div>
                )}

                {log.response && (
                  <div className="mb-2">
                    <p className="text-xs text-white/70 mb-1">Response:</p>
                    <p className="text-white text-sm bg-black/20 rounded p-2 whitespace-pre-wrap">
                      {log.response}
                    </p>
                  </div>
                )}

                {log.error && (
                  <div className="mb-2">
                    <p className="text-xs text-white/70 mb-1">Error:</p>
                    <p className="text-red-300 text-sm bg-black/20 rounded p-2">
                      {log.error}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
