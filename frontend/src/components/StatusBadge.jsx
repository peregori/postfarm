import React from 'react';

// Compact status indicator - just a colored dot
// size: 'dot' (tiny dot), 'sm' (small with optional label), 'md' (medium with label)
const StatusBadge = ({ status, size = 'dot' }) => {
  // Only show badge for posted or failed - everything else needs no indicator
  // scheduled = default state (no badge needed)
  // cancelled = post is removed from view (no badge needed)
  // publishing = transient state (rare to see)
  if (!status || status === 'scheduled' || status === 'cancelled') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'posted':
        return {
          label: 'Posted',
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950/30',
          textColor: 'text-green-700 dark:text-green-400',
        };
      case 'failed':
        return {
          label: 'Failed',
          dotColor: 'bg-red-500',
          bgColor: 'bg-red-50 dark:bg-red-950/30',
          textColor: 'text-red-700 dark:text-red-400',
        };
      case 'publishing':
        return {
          label: 'Publishing',
          dotColor: 'bg-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
          textColor: 'text-yellow-700 dark:text-yellow-400',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  // Dot only - minimal indicator
  if (size === 'dot') {
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${config.dotColor}`}
        title={config.label}
      />
    );
  }

  // Small - dot + label
  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-medium ${config.bgColor} ${config.textColor}`}>
        <span className={`w-1 h-1 rounded-full ${config.dotColor}`} />
        {config.label}
      </span>
    );
  }

  // Medium - slightly larger with label
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bgColor} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
