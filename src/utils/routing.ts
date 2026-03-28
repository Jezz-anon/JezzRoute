import { RoutePreferences, Waypoint } from '../types';
import { POIMarker } from './poiUtils';

interface MapboxRoute {
  distance: number;
  duration: number;
  geometry?: any;
}

interface MapboxResponse {
  code: string;
  routes: MapboxRoute[];
}

export interface RouteResult {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  chunks?: RouteChunk[]; // Optional chunk markers along the route
}

export interface RouteChunk {
  lat: number;
  lng: number;
  distance: number; // cumulative distance to this chunk
  duration: number; // cumulative duration to this chunk
  index: number;
}

// Build exclude parameter from user preferences
function buildExcludeParam(preferences: RoutePreferences, forceExcludeMotorway: boolean = false): string {
  const excludeList: string[] = [];
  
  if (preferences.avoidHighways || forceExcludeMotorway) {
    excludeList.push('motorway');
  }
  
  if (preferences.avoidTolls) {
    excludeList.push('toll');
  }

  if (preferences.avoidFerries) {
    excludeList.push('ferry');
  }
  
  if (excludeList.length === 0) {
    return '';
  }
  
  return `&exclude=${excludeList.join(',')}`;
}

// Generate an intermediate waypoint offset perpendicular to the direct path
// Forces the route through different areas for higher curviness
function generateOffsetWaypoint(
  start: Waypoint,
  end: Waypoint,
  curviness: number
): { lat: number; lng: number } {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;

  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;

  // Perpendicular direction (rotate 90°)
  const perpLat = -dLng;
  const perpLng = dLat;

  const length = Math.sqrt(perpLat * perpLat + perpLng * perpLng);
  if (length === 0) return { lat: midLat, lng: midLng };

  const normLat = perpLat / length;
  const normLng = perpLng / length;

  const directDist = Math.sqrt(dLat * dLat + dLng * dLng);

  // Offset: 5% to 25% of direct distance based on curviness (60-100)
  const factor = 0.05 + ((curviness - 60) / 40) * 0.20;
  const offset = directDist * Math.max(0.05, factor);

  // Deterministic side choice based on start coordinates
  const side = (Math.floor(Math.abs(start.lat * 1000) + Math.abs(start.lng * 1000)) % 2 === 0) ? 1 : -1;

  return {
    lat: midLat + normLat * offset * side,
    lng: midLng + normLng * offset * side,
  };
}

// Filter POIs to only those close to the route (within 1.5km corridor)
export function filterPOIsByRouteProximity(
  pois: POIMarker[],
  routeCoordinates: [number, number][]
): POIMarker[] {
  if (routeCoordinates.length < 5) {
    // If route is too short, show all POIs
    return pois;
  }
  
  // Tighter filtering - 1.5km corridor on each side of route for better relevance
  const maxDistanceKm = 1.5;
  const maxDistanceDeg = maxDistanceKm / 111;
  
  return pois.filter(poi => {
    // Sample densely enough that straight-line approximation stays close to actual route
    // Cap at every 10th point (~440m segments) to avoid missing POIs on curvy roads
    const sampleRate = Math.max(1, Math.min(10, Math.floor(routeCoordinates.length / 500)));
    let minDistance = Infinity;
    
    for (let i = 0; i < routeCoordinates.length - 1; i += sampleRate) {
      const [lat1, lng1] = routeCoordinates[i];
      const [lat2, lng2] = routeCoordinates[Math.min(i + sampleRate, routeCoordinates.length - 1)];
      
      const distance = distanceToLineSegment(poi.lat, poi.lng, lat1, lng1, lat2, lng2);
      minDistance = Math.min(minDistance, distance);
      
      if (minDistance < maxDistanceDeg * 0.2) break;
    }
    
    return minDistance < maxDistanceDeg;
  });
}

// Calculate distance from point to line segment (in degrees)
function distanceToLineSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // Points are identical
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }
  
  // Project point onto line segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  
  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}

export async function calculateRoute(
  waypoints: Waypoint[],
  preferences: RoutePreferences,
  signal?: AbortSignal
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    const fallback = waypoints.map(wp => [wp.lat, wp.lng]);
    console.log('Less than 2 waypoints, returning fallback:', fallback);
    return {
      coordinates: fallback,
      distance: 0,
      duration: 0,
    };
  }

  let timeout: NodeJS.Timeout | null = null;
  
  const attemptRoute = async (attempt: number = 1): Promise<RouteResult> => {
    try {
      const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_API_KEY;
      
      if (!MAPBOX_TOKEN) {
        throw new Error('Mapbox API key not configured');
      }

      // Compute effective curviness (preferScenic boosts to at least 60)
      const effectiveCurviness = preferences.preferScenic 
        ? Math.max(preferences.curviness, 60) : preferences.curviness;
      const forceExcludeMotorway = preferences.preferScenic || effectiveCurviness > 50;
      const excludeParam = buildExcludeParam(preferences, forceExcludeMotorway);

      // Build waypoint coordinates (include ALL user waypoints)
      let coordParts = waypoints.map(wp => `${wp.lng},${wp.lat}`);
      let useAlternatives = false;
      let radiusesParam = '';

      if (waypoints.length === 2 && effectiveCurviness > 60) {
        // High curviness: add offset intermediate waypoint for genuinely different routes
        const offset = generateOffsetWaypoint(waypoints[0], waypoints[waypoints.length - 1], effectiveCurviness);
        coordParts = [
          `${waypoints[0].lng},${waypoints[0].lat}`,
          `${offset.lng},${offset.lat}`,
          `${waypoints[waypoints.length - 1].lng},${waypoints[waypoints.length - 1].lat}`,
        ];
        // Large snap radius for offset point so Mapbox picks a through-road, not a dead-end
        radiusesParam = '&radiuses=unlimited;10000;unlimited';
        console.log(`Curvy mode (${effectiveCurviness}%) - offset waypoint at ${offset.lat.toFixed(3)},${offset.lng.toFixed(3)}`);
      } else if (waypoints.length === 2 && effectiveCurviness > 25) {
        useAlternatives = true;
        console.log(`Scenic mode (${effectiveCurviness}%) - requesting alternatives`);
      } else {
        console.log(`Direct mode (${effectiveCurviness}%) - ${waypoints.length} waypoints`);
      }

      const coords = coordParts.join(';');
      const altParam = useAlternatives ? '&alternatives=true' : '';
      let url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&overview=full&geometries=geojson&steps=false&continue_straight=true${altParam}${excludeParam}${radiusesParam}`;

      const controller = new AbortController();
      const mergedSignal = signal || controller.signal;
      timeout = setTimeout(() => controller.abort(), 45000);

      let response = await fetch(url, { signal: mergedSignal });

      // If exclude + alternatives causes 422, retry without exclude
      if (response.status === 422 && excludeParam && useAlternatives) {
        console.warn('Mapbox 422 with exclude+alternatives, retrying without exclude');
        url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&overview=full&geometries=geojson&steps=false&alternatives=true`;
        response = await fetch(url, { signal: mergedSignal });
      }

      if (timeout) clearTimeout(timeout);
      timeout = null;

      if (!response.ok) {
        if ((response.status >= 500 || response.status === 429) && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptRoute(2);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data: MapboxResponse = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`Mapbox: ${data.code}`);
      }

      // Select route based on curviness
      let selectedRoute: MapboxRoute;
      if (!useAlternatives || data.routes.length === 1) {
        selectedRoute = data.routes[0];
      } else {
        if (effectiveCurviness > 60) {
          selectedRoute = data.routes.reduce((max, r) => r.distance > max.distance ? r : max);
        } else if (effectiveCurviness > 40) {
          const sorted = [...data.routes].sort((a, b) => a.distance - b.distance);
          selectedRoute = sorted[Math.floor(sorted.length / 2)];
        } else {
          selectedRoute = data.routes[0];
        }
        console.log(`Selected from ${data.routes.length} alternatives (${(selectedRoute.distance / 1000).toFixed(1)}km)`);
      }

      console.log('Route:', (selectedRoute.distance / 1000).toFixed(1) + 'km, ' + (selectedRoute.duration / 60).toFixed(0) + 'min');

      // Extract coordinates
      if (!selectedRoute.geometry) throw new Error('No geometry');
      let coordinates_: [number, number][];
      if (typeof selectedRoute.geometry === 'object' && selectedRoute.geometry.coordinates) {
        coordinates_ = selectedRoute.geometry.coordinates;
      } else if (Array.isArray(selectedRoute.geometry)) {
        coordinates_ = selectedRoute.geometry as [number, number][];
      } else {
        throw new Error('Invalid geometry');
      }
      if (!coordinates_ || coordinates_.length < 2) throw new Error('Insufficient coordinates');

      const leafletCoordinates = coordinates_.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      const smoothedRoute = smoothRoute(leafletCoordinates);
      const chunks = generateRouteChunks(smoothedRoute, selectedRoute.distance, selectedRoute.duration);

      return {
        coordinates: smoothedRoute,
        distance: selectedRoute.distance,
        duration: selectedRoute.duration,
        chunks,
      };

    } catch (error) {
      if (timeout) clearTimeout(timeout);
      throw error;
    }
  };

  try {
    return await attemptRoute();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('Route request was cancelled');
      } else {
        console.error('Route calculation failed:', error.message);
      }
    }
    
    // Fallback: straight lines between waypoints
    console.log('Using fallback straight-line route');
    return {
      coordinates: waypoints.map(wp => [wp.lat, wp.lng]),
      distance: 0,
      duration: 0,
    };
  }
}

// Simple smoothing for rendered output
function smoothRoute(
  coordinates: [number, number][]
): [number, number][] {
  if (coordinates.length < 4) {
    return coordinates;
  }

  const result: [number, number][] = [];
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[i + 1];

    result.push([lat1, lng1]);

    // Add 1 interpolated point per segment for smoother rendering
    const t = 0.5;
    const interpLat = lat1 + (lat2 - lat1) * t;
    const interpLng = lng1 + (lng2 - lng1) * t;
    result.push([interpLat, interpLng]);
  }
  
  result.push(coordinates[coordinates.length - 1]);

  return result;
}

// Generate route chunks - split the route into 7 equal distance segments
function generateRouteChunks(
  coordinates: [number, number][],
  totalDistance: number,
  totalDuration: number,
  numChunks: number = 7
): RouteChunk[] {
  if (coordinates.length < 2) return [];

  const chunks: RouteChunk[] = [];
  const distancePerChunk = totalDistance / numChunks;
  const durationPerChunk = totalDuration / numChunks;

  let currentDistance = 0;
  let currentDuration = 0;

  // Add intermediate chunk points (skip first and last as those are waypoints)
  for (let i = 1; i < numChunks; i++) {
    const targetDistance = distancePerChunk * i;
    let accumulatedDistance = 0;

    // Find the coordinate closest to the target distance
    for (let j = 0; j < coordinates.length - 1; j++) {
      const [lat1, lng1] = coordinates[j];
      const [lat2, lng2] = coordinates[j + 1];

      // Rough distance calculation (simplified)
      const dx = lng2 - lng1;
      const dy = lat2 - lat1;
      const segmentDistance = Math.sqrt(dx * dx + dy * dy) * 111000; // approximately meters per degree

      if (accumulatedDistance + segmentDistance >= targetDistance) {
        // Found the segment containing the chunk point
        const ratio = (targetDistance - accumulatedDistance) / Math.max(segmentDistance, 1);
        const chunkLat = lat1 + (lat2 - lat1) * ratio;
        const chunkLng = lng1 + (lng2 - lng1) * ratio;

        chunks.push({
          lat: chunkLat,
          lng: chunkLng,
          distance: targetDistance,
          duration: durationPerChunk * i,
          index: i,
        });
        break;
      }

      accumulatedDistance += segmentDistance;
    }
  }

  return chunks;
}
