import theme from '../../config/dziri-theme.json';

// Native colors use the same semantic values as the ongoing Rails/Vue fork.
// Layout, fonts, sizes and spacing stay in the upstream native components.
function rgb(value: string): string {
  return `rgb(${value.trim().split(/\s+/).join(', ')})`;
}

export function colorsFor(dark: boolean) {
  const palette = dark ? theme.dark : theme.light;
  return {
    primary: theme.primary,
    background: rgb(palette['background-color']),
    surface: rgb(palette['surface-1']),
    text: rgb(palette['slate-12']),
    secondary: rgb(palette['slate-11']),
    border: rgb(palette['border-weak']),
    outgoing: theme.primary,
    outgoingText: '#ffffff',
  };
}

const steps = [1, 2, 3, 4, 5, 6, 7, 9, 9, 11, 12];
const levels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
function scale(palette: Record<string, string>, name: string) {
  return Object.fromEntries(
    levels.map((level, index) => [level, rgb(palette[`${name}-${steps[index]}`])]),
  );
}

export const nativeThemeColors = {
  blue: scale(theme.light, 'blue'),
  blueDark: scale(theme.dark, 'blue'),
  gray: scale(theme.light, 'slate'),
  grayDark: scale(theme.dark, 'slate'),
  slate: scale(theme.light, 'slate'),
  slateDark: scale(theme.dark, 'slate'),
};
