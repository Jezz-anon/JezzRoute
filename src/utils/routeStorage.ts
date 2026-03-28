import { MotorcycleRoute } from '../types';

const STORAGE_KEY_PREFIX = 'jezzroute_';
const ROUTES_LIST_KEY = 'jezzroute_routes_list';

export interface StoredRouteMetadata {
  id: string;
  name: string;
  savedAt: string;
  distance: number;
  waypointCount: number;
}

// Save a route to localStorage
export function saveRoute(route: MotorcycleRoute): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${route.id}`;
    localStorage.setItem(key, JSON.stringify(route));
    
    // Update routes list
    let routesList = getRoutesList();
    const metadata: StoredRouteMetadata = {
      id: route.id,
      name: route.name,
      savedAt: new Date().toISOString(),
      distance: route.totalDistance || 0,
      waypointCount: route.waypoints.length,
    };
    
    // Remove old entry if exists and add new metadata
    routesList = routesList.filter(r => r.id !== route.id);
    routesList.push(metadata);
    
    localStorage.setItem(ROUTES_LIST_KEY, JSON.stringify(routesList));
  } catch (error) {
    console.error('Failed to save route:', error);
    throw new Error('Failed to save route to local storage');
  }
}

// Load a route from localStorage
export function loadRoute(routeId: string): MotorcycleRoute | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${routeId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as MotorcycleRoute;
  } catch (error) {
    console.error('Failed to load route:', error);
    return null;
  }
}

// Get list of saved routes
export function getRoutesList(): StoredRouteMetadata[] {
  try {
    const stored = localStorage.getItem(ROUTES_LIST_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as StoredRouteMetadata[];
  } catch (error) {
    console.error('Failed to get routes list:', error);
    return [];
  }
}

// Delete a route from localStorage
export function deleteRoute(routeId: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${routeId}`;
    localStorage.removeItem(key);
    
    // Update routes list
    const routesList = getRoutesList();
    const updated = routesList.filter(r => r.id !== routeId);
    localStorage.setItem(ROUTES_LIST_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete route:', error);
  }
}

// Format distance for display
export function formatDistance(meters: number, units: 'km' | 'miles'): string {
  if (units === 'miles') {
    const miles = (meters / 1609.34).toFixed(1);
    return `${miles} mi`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

// Format duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
