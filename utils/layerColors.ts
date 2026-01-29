const DEFAULT_THEME_COLORS = ['#F26B5E', '#59322E', '#F26363', '#142601', '#BDBFB8'];
const THEME_CSS_VARS = [
    '--color-primary',
    '--color-primary-dark',
    '--color-accent',
    '--color-dark',
    '--color-light'
];

let cachedThemeColors: string[] | null = null;
let colorIndex = 0;
const usedColors = new Set<string>();

const readThemeColors = (): string[] => {
    if (cachedThemeColors) return cachedThemeColors;

    if (typeof window === 'undefined' || !document?.documentElement) {
        cachedThemeColors = [...DEFAULT_THEME_COLORS];
        return cachedThemeColors;
    }

    const styles = getComputedStyle(document.documentElement);
    const colors = THEME_CSS_VARS
        .map(variable => styles.getPropertyValue(variable).trim())
        .filter(Boolean);

    cachedThemeColors = colors.length > 0 ? colors : [...DEFAULT_THEME_COLORS];
    return cachedThemeColors;
};

const generatePurpleBlueColor = (): string => {
    const hue = Math.round(210 + Math.random() * 60); // 210-270
    const saturation = Math.round(60 + Math.random() * 20); // 60-80
    const lightness = Math.round(45 + Math.random() * 15); // 45-60
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getNextLayerColor = (): string => {
    const themeColors = readThemeColors();

    if (colorIndex < themeColors.length) {
        const color = themeColors[colorIndex];
        colorIndex += 1;
        usedColors.add(color);
        return color;
    }

    let color = generatePurpleBlueColor();
    let attempts = 0;
    while (usedColors.has(color) && attempts < 8) {
        color = generatePurpleBlueColor();
        attempts += 1;
    }

    usedColors.add(color);
    return color;
};
