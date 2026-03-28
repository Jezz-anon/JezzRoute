import React from 'react';
import { MotorcycleRoute } from '../types';
import { formatDistance, formatDuration } from '../utils/routeStorage';

interface Props {
  route: MotorcycleRoute;
  isCalculating: boolean;
}

export const RouteInfo: React.FC<Props> = ({ route, isCalculating }) => {
  if (route.waypoints.length < 2) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 z-[1000] min-w-64">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <span>📊</span>
        Route Details
      </h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Distance:</span>
          <span className="font-semibold text-orange-600">
            {isCalculating ? (
              <span className="inline-block w-8 h-4 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              formatDistance(route.totalDistance || 0, route.preferences.units)
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Duration:</span>
          <span className="font-semibold text-orange-600">
            {isCalculating ? (
              <span className="inline-block w-8 h-4 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              formatDuration(route.estimatedDuration || 0)
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-gray-600">Waypoints:</span>
          <span className="font-semibold text-gray-800">{route.waypoints.length}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Curviness:</span>
          <span className="font-semibold text-orange-600">{route.preferences.curviness}%</span>
        </div>
      </div>
    </div>
  );
};
