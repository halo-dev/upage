import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { globSync } from 'fast-glob';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'upage';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  orange: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
    accent: generateAlphaPalette(BASE_COLORS.accent[500]),
    blue: generateAlphaPalette(BASE_COLORS.accent[600]),
  },
};

export default defineConfig({
  safelist: [...Object.keys(customIconCollection[collectionName] || {}).map((x) => `i-upage:${x}`)],
  shortcuts: {
    'upage-ease-cubic-bezier': 'ease-[cubic-bezier(0.3,0,0.2,1)]',
    'transition-base': 'duration-200 upage-ease-cubic-bezier',
    'transition-theme': 'transition-[opacity,transform,box-shadow] transition-base',
    'transition-text-color': 'transition-colors transition-base',
    'transition-background': 'transition-[background-color] transition-base',
    'transition-border': 'transition-[border,box-shadow] transition-base',
    kdb: 'bg-upage-elements-code-background text-upage-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
  },
  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      upage: {
        elements: {
          borderColor: 'var(--upage-elements-borderColor)',
          borderColorActive: 'var(--upage-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--upage-elements-bg-depth-1)',
              2: 'var(--upage-elements-bg-depth-2)',
              3: 'var(--upage-elements-bg-depth-3)',
              4: 'var(--upage-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--upage-elements-textPrimary)',
          textSecondary: 'var(--upage-elements-textSecondary)',
          textTertiary: 'var(--upage-elements-textTertiary)',
          textSuccess: 'var(--upage-elements-textSuccess)',
          textWarning: 'var(--upage-elements-textWarning)',
          textError: 'var(--upage-elements-textError)',
          code: {
            background: 'var(--upage-elements-code-background)',
            text: 'var(--upage-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--upage-elements-button-primary-background)',
              backgroundHover: 'var(--upage-elements-button-primary-backgroundHover)',
              text: 'var(--upage-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--upage-elements-button-secondary-background)',
              backgroundHover: 'var(--upage-elements-button-secondary-backgroundHover)',
              text: 'var(--upage-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--upage-elements-button-danger-background)',
              backgroundHover: 'var(--upage-elements-button-danger-backgroundHover)',
              text: 'var(--upage-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--upage-elements-item-contentDefault)',
            contentActive: 'var(--upage-elements-item-contentActive)',
            contentAccent: 'var(--upage-elements-item-contentAccent)',
            contentDanger: 'var(--upage-elements-item-contentDanger)',
            backgroundDefault: 'var(--upage-elements-item-backgroundDefault)',
            backgroundActive: 'var(--upage-elements-item-backgroundActive)',
            backgroundAccent: 'var(--upage-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--upage-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--upage-elements-actions-background)',
            code: {
              background: 'var(--upage-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--upage-elements-artifacts-background)',
            backgroundHover: 'var(--upage-elements-artifacts-backgroundHover)',
            borderColor: 'var(--upage-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--upage-elements-artifacts-inlineCode-background)',
              text: 'var(--upage-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--upage-elements-messages-background)',
            linkColor: 'var(--upage-elements-messages-linkColor)',
            code: {
              background: 'var(--upage-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--upage-elements-messages-inlineCode-background)',
              text: 'var(--upage-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--upage-elements-icon-success)',
            error: 'var(--upage-elements-icon-error)',
            primary: 'var(--upage-elements-icon-primary)',
            secondary: 'var(--upage-elements-icon-secondary)',
            tertiary: 'var(--upage-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--upage-elements-preview-addressBar-background)',
              backgroundHover: 'var(--upage-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--upage-elements-preview-addressBar-backgroundActive)',
              text: 'var(--upage-elements-preview-addressBar-text)',
              textActive: 'var(--upage-elements-preview-addressBar-textActive)',
            },
          },
          dividerColor: 'var(--upage-elements-dividerColor)',
          loader: {
            background: 'var(--upage-elements-loader-background)',
            progress: 'var(--upage-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--upage-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--upage-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--upage-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--upage-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--upage-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--upage-elements-cta-background)',
            text: 'var(--upage-elements-cta-text)',
          },
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}
