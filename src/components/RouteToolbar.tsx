import React, { useState, useRef } from 'react';
import { MotorcycleRoute } from '../types';
import { formatDistance as formatDistanceUtil } from '../utils/routeStorage';

interface Props {
  route: MotorcycleRoute;
  onUpdateRoute: (updates: Partial<MotorcycleRoute>) => void;
  onClearRoute: () => void;
  onImportGPX: (content: string) => void;
  onCalculateRoute: () => void;
  onSaveRoute: () => void;
  onUndo: () => void;
  isCalculating: boolean;
}

export const RouteToolbar: React.FC<Props> = ({ route, onUpdateRoute, onClearRoute, onImportGPX, onCalculateRoute, onSaveRoute, onUndo, isCalculating }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editName, setEditName] = useState(route.name);
  const [editDesc, setEditDesc] = useState(route.description);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format duration from seconds to human readable format
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Format distance from meters using unit preference
  const formatDistance = (meters: number): string => {
    return formatDistanceUtil(meters, route.preferences.units);
  };

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateRoute({ name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveDesc = () => {
    onUpdateRoute({ description: editDesc.trim() });
    setIsEditingDesc(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onImportGPX(content);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏍️</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">JezzRoute</h1>
            <p className="text-xs text-gray-400">Plan. Ride. Share.</p>
          </div>
        </div>

        {/* Route Name & Description */}
        <div className="flex-1 max-w-md">
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="w-full px-3 py-1 text-lg font-semibold bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-orange-500"
              autoFocus
            />
          ) : (
            <h2
              className="text-lg font-semibold cursor-pointer hover:text-orange-400 transition-colors"
              onClick={() => {
                setEditName(route.name);
                setIsEditingName(true);
              }}
            >
              {route.name}
            </h2>
          )}
          
          {isEditingDesc ? (
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={handleSaveDesc}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveDesc()}
              placeholder="Add a description..."
              className="w-full px-2 py-0.5 text-sm bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-orange-500"
              autoFocus
            />
          ) : (
            <p
              className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors"
              onClick={() => {
                setEditDesc(route.description);
                setIsEditingDesc(true);
              }}
            >
              {route.description || 'Click to add description...'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".gpx"
            className="hidden"
          />
          
          <button
            onClick={onCalculateRoute}
            disabled={route.waypoints.length < 2 || isCalculating}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            title="Calculate route and show waypoint time"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isCalculating ? 'Calculating...' : 'Calculate'}
          </button>
          
          <button
            onClick={onUndo}
            disabled={route.waypoints.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm"
            title="Undo - Remove last waypoint"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 6H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-4" />
            </svg>
            Undo
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm"
            title="Import GPX"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          
          <button
            onClick={onSaveRoute}
            disabled={route.waypoints.length < 2}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            title="Save Route"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V3" />
            </svg>
            Save
          </button>
          
          <button
            onClick={onClearRoute}
            className="px-4 py-2 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 text-sm"
            title="Clear Route"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>

          {/* Route Stats */}
          {route.totalDistance && route.totalDistance > 0 && (
            <div className="ml-4 flex items-center gap-4 text-sm text-gray-300 border-l border-gray-600 pl-4">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span>{formatDistance(route.totalDistance)} km</span>
              </div>
              {route.estimatedDuration && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatDuration(route.estimatedDuration)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Add useRef import
