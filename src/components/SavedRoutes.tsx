import React, { useState, useEffect } from 'react';
import { MotorcycleRoute } from '../types';
import { getRoutesList, loadRoute, deleteRoute, StoredRouteMetadata, formatDistance } from '../utils/routeStorage';

interface Props {
  onLoadRoute: (route: MotorcycleRoute) => void;
  currentUnitPreference: 'km' | 'miles';
}

export const SavedRoutes: React.FC<Props> = ({ onLoadRoute, currentUnitPreference }) => {
  const [savedRoutes, setSavedRoutes] = useState<StoredRouteMetadata[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setSavedRoutes(getRoutesList());
  }, []);

  const handleLoadRoute = (routeId: string) => {
    const loaded = loadRoute(routeId);
    if (loaded) {
      onLoadRoute(loaded);
      setIsExpanded(false);
    }
  };

  const handleDeleteRoute = (routeId: string) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      deleteRoute(routeId);
      setSavedRoutes(getRoutesList());
    }
  };

  const handleToggleExpand = () => {
    // Refresh the list when expanding
    if (!isExpanded) {
      setSavedRoutes(getRoutesList());
    }
    setIsExpanded(!isExpanded);
  };

  if (savedRoutes.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-lg z-[1000]">
      <button
        onClick={handleToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-800">
          <span>💾</span>
          Saved Routes ({savedRoutes.length})
        </span>
        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
          {savedRoutes.map((route) => (
            <div
              key={route.id}
              className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 truncate text-sm">
                    {route.name}
                  </h4>
                  <div className="text-xs text-gray-500 space-y-1 mt-1">
                    <div>{formatDistance(route.distance, currentUnitPreference)} • {route.waypointCount} waypoints</div>
                    <div>
                      Saved: {new Date(route.savedAt).toLocaleDateString()} {new Date(route.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleLoadRoute(route.id)}
                    title="Load route"
                    className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded font-semibold transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(route.id)}
                    title="Delete route"
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded font-semibold transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
