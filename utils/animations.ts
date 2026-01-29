const ANIMATION_STYLE_ID = 'geo-explore-animations';

export const initAnimations = () => {
	if (typeof document === 'undefined') return;
	if (document.getElementById(ANIMATION_STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = ANIMATION_STYLE_ID;
	style.textContent = `
@keyframes urgentPulse {
	0% { transform: scale(1); stroke-width: 2; }
	50% { transform: scale(1.8); stroke-width: 3.5; }
	100% { transform: scale(1); stroke-width: 2; }
}

.urgent-pulse-effect {
	animation: urgentPulse 1.2s ease-in-out infinite;
	transform-origin: center;
	transform-box: fill-box;
	filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.9)) drop-shadow(0 0 16px rgba(239, 68, 68, 0.8));
	stroke: #ef4444 !important;
	fill: #ef4444 !important;
	opacity: 1 !important;
	fill-opacity: 1 !important;
}
`;
	document.head.appendChild(style);
};

initAnimations();
