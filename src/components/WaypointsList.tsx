import React from 'react';
import { Waypoint } from '../types';

interface Props {
  waypoints: Waypoint[];
  onReorder: (waypoints: Waypoint[]) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onFocus: (waypoint: Waypoint) => void;
}

export const WaypointsList: React.FC<Props> = ({
  waypoints,
  onReorder,
  onRemove,
  onRename,
  onFocus,
}) => {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newWaypoints = [...waypoints];
    [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
    onReorder(newWaypoints.map((wp, i) => ({ ...wp, order: i })));
  };

  const moveDown = (index: number) => {
    if (index === waypoints.length - 1) return;
    const newWaypoints = [...waypoints];
    [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
    onReorder(newWaypoints.map((wp, i) => ({ ...wp, order: i })));
  };

  if (waypoints.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Waypoints
        </h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📍</div>
          <p className="text-sm">Click on the map to add waypoints</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Waypoints
        <span className="ml-auto text-sm font-normal text-gray-500">
          {waypoints.length} point{waypoints.length !== 1 ? 's' : ''}
        </span>
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {waypoints.map((waypoint, index) => (
          <WaypointItem
            key={waypoint.id}
            waypoint={waypoint}
            index={index}
            isFirst={index === 0}
            isLast={index === waypoints.length - 1}
            onMoveUp={() => moveUp(index)}
            onMoveDown={() => moveDown(index)}
            onRemove={() => onRemove(waypoint.id)}
            onRename={(name) => onRename(waypoint.id, name)}
            onFocus={() => onFocus(waypoint)}
          />
        ))}
      </div>
    </div>
  );
};

interface WaypointItemProps {
  waypoint: Waypoint;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onFocus: () => void;
}

const WaypointItem: React.FC<WaypointItemProps> = ({
  waypoint,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRename,
  onFocus,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(waypoint.name);

  const handleSave = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const getWaypointIcon = () => {
    if (isFirst) return '🚀';
    if (isLast) return '🏁';
    return '📍';
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-orange-50 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">
        {getWaypointIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
        ) : (
          <div
            className="font-medium text-sm text-gray-800 truncate cursor-pointer hover:text-orange-600"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            {waypoint.name || `Point ${index + 1}`}
          </div>
        )}
        <div className="text-xs text-gray-500">
          {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onFocus}
          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
          title="Focus on map"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1 text-gray-400 hover:text-orange-500 disabled:opacity-30 transition-colors"
          title="Move up"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1 text-gray-400 hover:text-orange-500 disabled:opacity-30 transition-colors"
          title="Move down"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove waypoint"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
