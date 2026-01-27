import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Circle, Square, Pencil } from 'lucide-react';
import { FeatureCollection } from 'geojson';

interface LeafletDrawingToolsProps {
    isActive: boolean;
    onShapeCreated: (layer: any) => void;
}

export const LeafletDrawingTools: React.FC<LeafletDrawingToolsProps> = ({ isActive, onShapeCreated }) => {
    const map = useMap();
    const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>(null);
    const [shapeCount, setShapeCount] = useState(0);

    useEffect(() => {
        if (!isActive || !drawMode) return;

        let isDrawing = false;
        let startPoint: L.LatLng | null = null;
        let points: L.LatLng[] = [];
        let tempLayer: L.Layer | null = null;

        const handleMouseDown = (e: L.LeafletMouseEvent) => {
            isDrawing = true;
            startPoint = e.latlng;
            points = [e.latlng];
        };

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDrawing || !startPoint) return;

            if (tempLayer) map.removeLayer(tempLayer);

            if (drawMode === 'polygon') {
                tempLayer = L.polyline([...points, e.latlng], { color: 'blue', weight: 2 });
                tempLayer.addTo(map);
            } else if (drawMode === 'rectangle') {
                const bounds = L.latLngBounds(startPoint, e.latlng);
                tempLayer = L.rectangle(bounds, { color: 'green', weight: 2, fill: false });
                tempLayer.addTo(map);
            } else if (drawMode === 'circle') {
                const distance = map.latLngToContainerPoint(startPoint).distanceTo(map.latLngToContainerPoint(e.latlng));
                tempLayer = L.circle(startPoint, distance, { color: 'orange', weight: 2, fill: false });
                tempLayer.addTo(map);
            }
        };

        const handleMouseUp = (e: L.LeafletMouseEvent) => {
            if (!isDrawing) return;
            isDrawing = false;

            if (tempLayer) {
                map.removeLayer(tempLayer);
                tempLayer = null;
            }

            setShapeCount(c => c + 1);
            const newCount = shapeCount + 1;
            const shapeName = `Shape-${String(newCount).padStart(2, '0')}`;

            let geoJson: any;
            if (drawMode === 'polygon') {
                const polygon = L.polygon([...points, e.latlng], { color: '#6366f1' });
                geoJson = polygon.toGeoJSON();
            } else if (drawMode === 'rectangle') {
                const bounds = L.latLngBounds(startPoint!, e.latlng);
                const polygon = L.rectangle(bounds, { color: '#6366f1' });
                geoJson = polygon.toGeoJSON();
            } else if (drawMode === 'circle') {
                const distance = map.latLngToContainerPoint(startPoint!).distanceTo(map.latLngToContainerPoint(e.latlng));
                const circle = L.circle(startPoint!, distance, { color: '#6366f1' });
                geoJson = circle.toGeoJSON();
            }

            const layer = {
                id: `shape-${Date.now()}`,
                name: shapeName,
                visible: true,
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        ...geoJson,
                        properties: {
                            name: shapeName,
                            type: 'user-drawn-shape',
                            createdAt: new Date().toISOString()
                        }
                    }]
                } as FeatureCollection,
                color: '#6366f1',
                opacity: 0.4,
                type: 'polygon',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };

            onShapeCreated(layer);
            setDrawMode(null);
            points = [];
        };

        map.on('mousedown', handleMouseDown);
        map.on('mousemove', handleMouseMove);
        map.on('mouseup', handleMouseUp);
        map.dragging.disable();

        return () => {
            map.off('mousedown', handleMouseDown);
            map.off('mousemove', handleMouseMove);
            map.off('mouseup', handleMouseUp);
            map.dragging.enable();
        };
    }, [map, drawMode, isActive, shapeCount]);

    if (!isActive) return null;

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 bg-white rounded-lg shadow-2xl p-3 border-2 border-blue-500 pointer-events-auto">
            <div className="text-xs font-bold text-slate-600 text-center">Draw Shapes</div>
            <button
                onClick={() => setDrawMode(drawMode === 'polygon' ? null : 'polygon')}
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${drawMode === 'polygon' ? 'bg-blue-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
                <Pencil size={18} className="inline mr-2" />
                Polygon
            </button>
            <button
                onClick={() => setDrawMode(drawMode === 'rectangle' ? null : 'rectangle')}
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${drawMode === 'rectangle' ? 'bg-green-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
                <Square size={18} className="inline mr-2" />
                Rectangle
            </button>
            <button
                onClick={() => setDrawMode(drawMode === 'circle' ? null : 'circle')}
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${drawMode === 'circle' ? 'bg-orange-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
                <Circle size={18} className="inline mr-2" />
                Circle
            </button>
        </div>
    );
};
