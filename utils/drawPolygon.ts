import L from 'leaflet';
import { Feature } from 'geojson';

export interface DrawingOptions {
  onShapeCreated?: (shape: Feature) => void;
  onModeChange?: (mode: string | null) => void;
}

export class PolygonDrawer {
  private map: L.Map;
  private pointsRef: L.LatLng[] = [];
  private tempPolylineRef: L.Polyline | null = null;
  private startPointRef: L.LatLng | null = null;
  private drawMode: 'polygon' | 'rectangle' | 'circle' | null = null;
  private options: DrawingOptions;
  private eventHandlers: { [key: string]: Function } = {};

  constructor(map: L.Map, options: DrawingOptions = {}) {
    this.map = map;
    this.options = options;
  }

  public setMode(mode: 'polygon' | 'rectangle' | 'circle' | null) {
    if (this.drawMode === mode) {
      this.cancelDrawing();
      return;
    }

    // Clean up previous mode
    if (this.drawMode) {
      this.removeEventListeners();
    }

    this.drawMode = mode;

    if (mode) {
      this.enableDrawing();
    } else {
      this.disableDrawing();
    }

    this.options.onModeChange?.(mode);
  }

  private enableDrawing() {
    this.map.dragging.disable();
    this.map.getContainer().style.cursor = 'crosshair';

    const handleClick = this.handleClick.bind(this);
    const handleRightClick = this.handleRightClick.bind(this);
    const handleDoubleClick = this.handleDoubleClick.bind(this);
    const handleMouseDown = this.handleMouseDown.bind(this);
    const handleMouseMove = this.handleMouseMove.bind(this);
    const handleMouseUp = this.handleMouseUp.bind(this);

    this.eventHandlers = {
      click: handleClick,
      contextmenu: handleRightClick,
      dblclick: handleDoubleClick,
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp,
    };

    this.map.on('click', handleClick as any);
    this.map.on('contextmenu', handleRightClick as any);
    this.map.on('dblclick', handleDoubleClick as any);
    this.map.on('mousedown', handleMouseDown as any);
    this.map.on('mousemove', handleMouseMove as any);
    this.map.on('mouseup', handleMouseUp as any);
  }

  private disableDrawing() {
    this.cancelDrawing();
    this.map.dragging.enable();
    this.map.getContainer().style.cursor = '';
    this.removeEventListeners();
  }

  private removeEventListeners() {
    Object.entries(this.eventHandlers).forEach(([eventName, handler]) => {
      this.map.off(eventName as any, handler as any);
    });
    this.eventHandlers = {};
  }

  private handleClick(e: L.LeafletMouseEvent) {
    if (this.drawMode === 'polygon') {
      this.pointsRef.push(e.latlng);
      this.updatePolylinePreview();
    }
  }

  private handleRightClick(e: L.LeafletMouseEvent) {
    if (this.drawMode === 'polygon' && this.pointsRef.length >= 3) {
      this.finishPolygon();
    }
  }

  private handleDoubleClick(e: L.LeafletMouseEvent) {
    L.DomEvent.stop(e);
    if (this.drawMode === 'polygon' && this.pointsRef.length >= 3) {
      this.finishPolygon();
    }
  }

  private handleMouseDown(e: L.LeafletMouseEvent) {
    if (this.drawMode === 'rectangle' || this.drawMode === 'circle') {
      this.startPointRef = e.latlng;
    }
  }

  private handleMouseMove(e: L.LeafletMouseEvent) {
    if ((this.drawMode === 'rectangle' || this.drawMode === 'circle') && this.startPointRef) {
      this.updateShapePreview(this.startPointRef, e.latlng);
    }
  }

  private handleMouseUp(e: L.LeafletMouseEvent) {
    if ((this.drawMode === 'rectangle' || this.drawMode === 'circle') && this.startPointRef) {
      const shape = this.drawMode === 'rectangle'
        ? this.createRectangle(this.startPointRef, e.latlng)
        : this.createCircle(this.startPointRef, e.latlng);
      
      this.finishShape(shape);
    }
  }

  private updatePolylinePreview() {
    if (this.tempPolylineRef) this.map.removeLayer(this.tempPolylineRef);
    
    if (this.pointsRef.length >= 1) {
      const closedPoints = [...this.pointsRef, this.pointsRef[0]];
      this.tempPolylineRef = L.polyline(closedPoints, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '5, 5',
        opacity: 0.8
      }).addTo(this.map);
    }
  }

  private updateShapePreview(start: L.LatLng, end: L.LatLng) {
    if (this.tempPolylineRef) this.map.removeLayer(this.tempPolylineRef);
    
    const previewShape = this.drawMode === 'rectangle'
      ? this.createRectangle(start, end)
      : this.createCircle(start, end);
    
    this.tempPolylineRef = L.polyline(previewShape, {
      color: '#3b82f6',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.8
    }).addTo(this.map);
  }

  private finishPolygon() {
    if (this.pointsRef.length >= 3) {
      const coords = this.pointsRef.map(p => [p.lng, p.lat] as [number, number]);
      coords.push(coords[0]); // Close the polygon
      this.finishShape(coords);
    }
  }

  private finishShape(coords: [number, number][]) {
    const feature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      },
      properties: {
        name: `Shape-${String(Math.random()).slice(2, 6)}`,
        type: this.drawMode
      }
    };

    this.options.onShapeCreated?.(feature);
    this.cancelDrawing();
  }

  private createRectangle(start: L.LatLng, end: L.LatLng): [number, number][] {
    return [
      [start.lng, start.lat],
      [start.lng, end.lat],
      [end.lng, end.lat],
      [end.lng, start.lat],
      [start.lng, start.lat]
    ];
  }

  private createCircle(center: L.LatLng, edge: L.LatLng): [number, number][] {
    const radius = center.distanceTo(edge);
    const points: [number, number][] = [];
    
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const point = L.latLng(
        center.lat + (radius / 111000) * Math.cos(angle),
        center.lng + (radius / 111000 / Math.cos(center.lat * Math.PI / 180)) * Math.sin(angle)
      );
      points.push([point.lng, point.lat]);
    }
    
    return points;
  }

  private cancelDrawing() {
    if (this.tempPolylineRef) {
      this.map.removeLayer(this.tempPolylineRef);
      this.tempPolylineRef = null;
    }
    this.pointsRef = [];
    this.startPointRef = null;
  }

  public getMode(): string | null {
    return this.drawMode;
  }

  public destroy() {
    this.setMode(null);
  }
}
