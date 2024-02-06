export type Coords = {
    x: number;
    y: number;
  };
  
  export type Gesture = {
    origin: Coords;
    translation: Coords;
    scale: number;
    rotation?: number;
  };
  
  export type GestureCallbacks = {
    onGestureStart?: (gesture: Gesture) => void;
    onGestureChange?: (gesture: Gesture) => void;
    onGestureEnd?: (gesture: Gesture) => void;
  };
  
  export type NormalizedWheelEvent = {
    dx: number;
    dy: number;
  };