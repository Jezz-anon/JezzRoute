export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  order: number;
}

export interface RoutePreferences {
  curviness: number; // 0-100, higher = more curves preferred
  avoidHighways: boolean;
  avoidUnpaved: boolean;
  avoidTolls: boolean;
  avoidFerries: boolean;
  preferScenic: boolean;
  units: 'km' | 'miles';
  voiceAlerts: boolean;
  speedCameraAlerts: boolean;
}

export interface MotorcycleRoute {
  id: string;
  name: string;
  description: string;
  waypoints: Waypoint[];
  preferences: RoutePreferences;
  /**
   * Date when the route was created.
   * Accepts a Date object or an ISO string (e.g., "2024-06-01T12:00:00Z").
   */
  createdAt: Date | string;
  /**
   * Date when the route was last updated.
   * Accepts a Date object or an ISO string (e.g., "2024-06-01T12:00:00Z").
   */
  updatedAt: Date | string;
  totalDistance?: number;
  estimatedDuration?: number;
}

/**
 * Default route preferences used when creating a new motorcycle route.
 * Provides initial values for curviness, avoidance options, and scenic preference.
 */
export const defaultPreferences: RoutePreferences = {
  curviness: 50,
  avoidHighways: false,
  avoidUnpaved: true,
  avoidTolls: false,
  avoidFerries: false,
  preferScenic: false,
  units: 'km',
  voiceAlerts: false,
  speedCameraAlerts: false,
};

export const createDefaultRoute = (): Omit<MotorcycleRoute, 'id'> => ({
  name: 'New Route',
  description: '',
  waypoints: [],
  preferences: { ...defaultPreferences },
  createdAt: new Date(),
  updatedAt: new Date(),
});
