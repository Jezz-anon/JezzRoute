import React, { useState } from 'react';
import { MotorcycleRoute } from '../types';
import {
  exportToGPX,
  exportToGarmin,
  exportToTomTom,
  exportToTomTomGPX,
  downloadFile,
  generateFilename,
  calculateRouteDistance,
} from '../utils/exportUtils';

interface Props {
  route: MotorcycleRoute;
}

interface ExportOptionProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

const ExportOption: React.FC<ExportOptionProps> = ({ icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0"
  >
    <span className="text-xl">{icon}</span>
    <div>
      <div className="font-medium text-gray-800">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  </button>
);

export const ExportPanel: React.FC<Props> = ({ route }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format: 'gpx' | 'garmin' | 'tomtom-itn' | 'tomtom-gpx') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'gpx':
        content = exportToGPX(route);
        filename = generateFilename(route.name, 'gpx');
        mimeType = 'application/gpx+xml';
        break;
      case 'garmin':
        content = exportToGarmin(route);
        filename = generateFilename(route.name + '_garmin', 'gpx');
        mimeType = 'application/gpx+xml';
        break;
      case 'tomtom-itn':
        content = exportToTomTom(route);
        filename = generateFilename(route.name, 'itn');
        mimeType = 'text/plain';
        break;
      case 'tomtom-gpx':
        content = exportToTomTomGPX(route);
        filename = generateFilename(route.name + '_tomtom', 'gpx');
        mimeType = 'application/gpx+xml';
        break;
      default:
        content = '';
        filename = '';
        mimeType = '';
        break;
    }

    if (content && filename && mimeType) {
      downloadFile(content, filename, mimeType);
    } else {
      // Optionally show an error or log
      console.error('Invalid export format or missing data');
    }
    setShowExportMenu(false);
  };

  const distance = calculateRouteDistance(route.waypoints);

  // Format duration from seconds to human readable format
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Format distance from meters to km
  const formatDistance = (meters: number): string => {
    return (meters / 1000).toFixed(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Route
      </h3>

      {/* Route Stats */}
      {route.waypoints.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {route.totalDistance ? formatDistance(route.totalDistance) : distance.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">{route.totalDistance ? 'km (route)' : 'km (direct)'}</div>
            </div>
            <div>
              {route.estimatedDuration ? (
                <>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatDuration(route.estimatedDuration)}
                  </div>
                  <div className="text-xs text-gray-500">estimated time</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-orange-600">
                    {route.waypoints.length}
                  </div>
                  <div className="text-xs text-gray-500">waypoints</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={route.waypoints.length < 2}
          className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Route
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showExportMenu && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10">
            <ExportOption
              icon="📄"
              title="Standard GPX"
              description="Universal GPX format for most apps"
              onClick={() => handleExport('gpx')}
            />
            <ExportOption
              icon="📍"
              title="Garmin (BaseCamp)"
              description="Optimized for Garmin devices & BaseCamp"
              onClick={() => handleExport('garmin')}
            />
            <ExportOption
              icon="🗺️"
              title="TomTom ITN"
              description="TomTom itinerary format (.itn)"
              onClick={() => handleExport('tomtom-itn')}
            />
            <ExportOption
              icon="🧭"
              title="TomTom GPX"
              description="TomTom GPX format with extensions"
              onClick={() => handleExport('tomtom-gpx')}
            />
          </div>
        )}
      </div>

      {route.waypoints.length < 2 && (
        <p className="text-xs text-gray-500 text-center mt-2">
          Add at least 2 waypoints to export
        </p>
      )}
    </div>
  );
};
