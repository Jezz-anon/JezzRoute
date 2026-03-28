import React, { useState } from 'react';
import { Waypoint } from '../types';

interface Props {
  waypoints: Waypoint[];
  totalDistance?: number;
  estimatedDuration?: number;
  units: 'km' | 'miles';
  onRemoveWaypoint?: (id: string) => void;
}

export const MapWaypointsPanel: React.FC<Props> = ({
  waypoints,
  totalDistance,
  estimatedDuration,
  units,
  onRemoveWaypoint,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (waypoints.length === 0) return null;

  const formatDistance = (meters: number): string => {
    if (units === 'miles') {
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)} mi`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-lg z-[1000]">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="font-semibold text-gray-800 text-sm">Route Details</h3>
        <button className="text-gray-600 hover:text-gray-800">
          {isCollapsed ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 max-w-xs max-h-96 overflow-y-auto space-y-3">
          {/* Summary */}
          {(totalDistance || estimatedDuration) && (
            <div className="bg-orange-50 rounded-lg p-3 space-y-1">
              {totalDistance && (
                <div className="text-sm">
                  <span className="text-gray-600">Distance:</span>
                  <span className="font-semibold text-orange-600 ml-2">{formatDistance(totalDistance)}</span>
                </div>
              )}
              {estimatedDuration && (
                <div className="text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold text-orange-600 ml-2">{formatDuration(estimatedDuration)}</span>
                </div>
              )}
            </div>
          )}

          {/* Waypoints List */}
          <div className="space-y-2">
            {waypoints.map((waypoint, index) => {
              const isStart = index === 0;
              const isEnd = index === waypoints.length - 1;
              const icon = isStart ? '🟢' : isEnd ? '🔴' : '🟠';

              return (
                <div key={waypoint.id} className="flex items-start justify-between gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-lg mt-px">{icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">
                        {waypoint.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  {onRemoveWaypoint && !isStart && !isEnd && (
                    <button
                      onClick={() => onRemoveWaypoint(waypoint.id)}
                      className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                      title="Remove waypoint"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
