import React, { useEffect, useRef, useState } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Circle, Square, Pencil } from 'lucide-react';
import { FeatureCollection } from 'geojson';

interface DrawingToolsProps {
    map: any;
    isActive: boolean;
    onShapeCreated: (layer: any) => void;
}

export const DrawingTools: React.FC<DrawingToolsProps> = ({ map, isActive, onShapeCreated }) => {
    const drawRef = useRef<MapboxDraw | null>(null);
    const shapeCountRef = useRef<number>(0);
    const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>(null);

    useEffect(() => {
        if (!map || !isActive) return;

        if (!drawRef.current) {
            try {
                drawRef.current = new MapboxDraw({
                    displayControlsDefault: false,
                    controls: {
                        polygon: true,
                        trash: true,
                        point: false,
                        line_string: false,
                        combine_features: false,
                        uncombine_features: false
                    }
                });
                map.addControl(drawRef.current);
                console.log('✅ MapboxDraw initialized');
            } catch (error) {
                console.error('Error initializing MapboxDraw:', error);
            }
        }

        const processShape = () => {
            if (!drawRef.current) return;
            const data = drawRef.current.getAll();
            console.log('📦 Draw data:', data);
            
            if (data.features.length === 0) return;

            const lastFeature = data.features[data.features.length - 1];
            console.log('🎯 Geometry type:', lastFeature.geometry.type);
            
            if (lastFeature.geometry.type !== 'Polygon' && lastFeature.geometry.type !== 'MultiPolygon') {
                return;
            }

            shapeCountRef.current++;
            const shapeName = `Shape-${String(shapeCountRef.current).padStart(2, '0')}`;
            console.log(`✅ Created layer: ${shapeName}`);

            const layer = {
                id: `shape-${Date.now()}`,
                name: shapeName,
                visible: true,
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            ...lastFeature,
                            properties: {
                                name: shapeName,
                                type: 'user-drawn-shape',
                                createdAt: new Date().toISOString()
                            }
                        }
                    ]
                } as FeatureCollection,
                color: '#6366f1',
                opacity: 0.4,
                type: 'polygon',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };

            onShapeCreated(layer);
            drawRef.current.deleteAll();
            setDrawMode(null);
        };

        map.on('draw.create', processShape);
        map.on('draw.update', processShape);

        return () => {
            map.off('draw.create', processShape);
            map.off('draw.update', processShape);
        };
    }, [map, isActive, onShapeCreated]);

    const handlePolygon = () => {
        if (!drawRef.current) return;
        console.log('🔵 Polygon mode');
        drawRef.current.changeMode('draw_polygon');
        setDrawMode('polygon');
    };

    const handleRectangle = () => {
        if (!drawRef.current) return;
        console.log('🟩 Rectangle mode');
        drawRef.current.changeMode('draw_rectangle');
        setDrawMode('rectangle');
    };

    const handleCircle = () => {
        if (!drawRef.current) return;
        console.log('🟠 Circle mode');
        drawRef.current.changeMode('draw_circle');
        setDrawMode('circle');
    };

    if (!isActive) return null;

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 bg-white rounded-lg shadow-2xl p-3 border-2 border-blue-500">
            <div className="text-xs font-bold text-slate-600 text-center">Draw Shapes</div>
            <button
                onClick={handlePolygon}
                title="Draw Polygon"
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${
                    drawMode === 'polygon'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
                <Pencil size={20} className="inline mr-2" />
                Polygon
            </button>
            <button
                onClick={handleRectangle}
                title="Draw Rectangle"
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${
                    drawMode === 'rectangle'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
                <Square size={20} className="inline mr-2" />
                Rectangle
            </button>
            <button
                onClick={handleCircle}
                title="Draw Circle"
                className={`px-4 py-2 rounded transition-all font-bold text-sm ${
                    drawMode === 'circle'
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
                <Circle size={20} className="inline mr-2" />
                Circle
            </button>
        </div>
    );
};
