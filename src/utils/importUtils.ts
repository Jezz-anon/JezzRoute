import { v4 as uuidv4 } from 'uuid';
import { Waypoint, MotorcycleRoute, defaultPreferences } from '../types';

interface ParsedGPX {
  name: string;
  description: string;
  waypoints: Waypoint[];
}

export function parseGPX(content: string): ParsedGPX {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  
  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX file format');
  }

  let name = 'Imported Route';
  let description = '';
  const waypoints: Waypoint[] = [];

  // Get metadata
  const metadataName = doc.querySelector('metadata > name')?.textContent;
  const metadataDesc = doc.querySelector('metadata > desc')?.textContent;
  
  if (metadataName) name = metadataName;
  if (metadataDesc) description = metadataDesc;

  // Try to get route points first (rtept)
  const routePoints = doc.querySelectorAll('rte > rtept');
  if (routePoints.length > 0) {
    routePoints.forEach((point, index) => {
      const lat = parseFloat(point.getAttribute('lat') || '0');
      const lng = parseFloat(point.getAttribute('lon') || '0');
      const wpName = point.querySelector('name')?.textContent || `Point ${index + 1}`;
      
      if (lat && lng) {
        waypoints.push({
          id: uuidv4(),
          lat,
          lng,
          name: wpName,
          order: index,
        });
      }
    });
  }

  // If no route points, try track points (trkpt)
  if (waypoints.length === 0) {
    const trackPoints = doc.querySelectorAll('trk > trkseg > trkpt');
    if (trackPoints.length > 0) {
      // For tracks, we might want to simplify by taking every nth point
      const step = Math.max(1, Math.floor(trackPoints.length / 50)); // Max 50 waypoints
      
      trackPoints.forEach((point, index) => {
        if (index % step === 0 || index === trackPoints.length - 1) {
          const lat = parseFloat(point.getAttribute('lat') || '0');
          const lng = parseFloat(point.getAttribute('lon') || '0');
          const wpName = point.querySelector('name')?.textContent || `Point ${waypoints.length + 1}`;
          
          if (lat && lng) {
            waypoints.push({
              id: uuidv4(),
              lat,
              lng,
              name: wpName,
              order: waypoints.length,
            });
          }
        }
      });
    }
  }

  // If still no points, try waypoints (wpt)
  if (waypoints.length === 0) {
    const wpts = doc.querySelectorAll('wpt');
    wpts.forEach((point, index) => {
      const lat = parseFloat(point.getAttribute('lat') || '0');
      const lng = parseFloat(point.getAttribute('lon') || '0');
      const wpName = point.querySelector('name')?.textContent || `Waypoint ${index + 1}`;
      
      if (lat && lng) {
        waypoints.push({
          id: uuidv4(),
          lat,
          lng,
          name: wpName,
          order: index,
        });
      }
    });
  }

  // Get track/route name if metadata name wasn't found
  if (!metadataName) {
    const routeName = doc.querySelector('rte > name')?.textContent;
    const trackName = doc.querySelector('trk > name')?.textContent;
    name = routeName || trackName || name;
  }

  return { name, description, waypoints };
}

export function importGPXToRoute(content: string): Partial<MotorcycleRoute> {
  const parsed = parseGPX(content);
  
  return {
    name: parsed.name,
    description: parsed.description,
    waypoints: parsed.waypoints,
    preferences: { ...defaultPreferences },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
