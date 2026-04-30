type TokenMap = Record<string, string>;
type NestedTokenMap = Record<string, Record<string, string>>;
export type DesignSystemColorEntry = { name: string; hex: string };

export type ParsedDesignSystem = {
  name: string;
  description?: string;
  overview?: string;
  colors: TokenMap;
  typography: NestedTokenMap;
  rounded: TokenMap;
  spacing: TokenMap;
  components: NestedTokenMap;
};

export type DesignSystemPreviewModel = {
  brandName: string;
  allColors: DesignSystemColorEntry[];
  fontFamily: string | null;
  resolvedDescription: string;
  canvasHex: string;
  surfaceHex: string;
  inkHex: string;
  bodyHex: string;
  borderHex: string;
  accentHex: string;
  accentText: string;
  secondAccentHex: string;
};

export function extractBrandNameFromDesignMd(content: string): string {
  const yamlName = extractFrontmatter(content)
    .match(/^name:\s*(.+)$/m)?.[1]
    ?.trim();
  if (yamlName) {
    return stripWrappingQuotes(yamlName);
  }

  const h1 = content.match(/^#\s+(.+)$/m)?.[1] ?? '';
  const inspired = h1.match(/inspired by\s+(.+)$/i)?.[1]?.trim();
  if (inspired) {
    return inspired;
  }

  const designSystemName = h1.match(/^(.+?)\s+design system/i)?.[1]?.trim();
  if (designSystemName) {
    return designSystemName;
  }

  if (h1.trim()) {
    return h1.trim();
  }

  return '自定义设计系统';
}

export function parseDesignSystem(content: string): ParsedDesignSystem {
  const frontmatter = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const parsedRoot = frontmatter ? parseYamlLikeObject(frontmatter) : {};
  const sections = extractMarkdownSections(body);
  const overview = sections.Overview || sections['Brand & Style'] || getFirstSectionContent(sections);

  return {
    name: getStringValue(parsedRoot.name) || extractBrandNameFromDesignMd(content),
    description: getStringValue(parsedRoot.description),
    overview,
    colors: getStringMap(parsedRoot.colors),
    typography: getNestedStringMap(parsedRoot.typography),
    rounded: getStringMap(parsedRoot.rounded),
    spacing: getStringMap(parsedRoot.spacing),
    components: getNestedStringMap(parsedRoot.components),
  };
}

export function buildDesignSystemPreviewModel(content: string, description: string): DesignSystemPreviewModel {
  const designSystem = parseDesignSystem(content);
  const brandName = designSystem.name || extractBrandNameFromDesignMd(content) || '品牌';
  const tokenColors = Object.entries(designSystem.colors)
    .filter(([, value]) => /^#[0-9a-fA-F]{6}$/.test(value))
    .map(([name, hex]) => ({ name, hex: hex.toLowerCase() }));
  const allColors = tokenColors.length > 0 ? tokenColors.slice(0, 10) : extractDesignSystemColors(content);
  const preferredTypography =
    designSystem.typography['display-xl'] ||
    designSystem.typography['display-lg'] ||
    designSystem.typography['title-lg'] ||
    designSystem.typography['body-md'] ||
    designSystem.typography.button;
  const fontFamily = preferredTypography?.fontFamily || extractDesignSystemFontFamily(content);
  const resolvedDescription = designSystem.description || description;
  const canvasHex = designSystem.colors.canvas || designSystem.colors.background || '#faf9f5';
  const surfaceHex = designSystem.colors['surface-card'] || designSystem.colors.surface || '#ffffff';
  const inkHex = designSystem.colors.ink || designSystem.colors['body-strong'] || '#111111';
  const bodyHex = designSystem.colors.body || designSystem.colors.muted || '#4b5563';
  const borderHex = designSystem.colors.hairline || designSystem.colors.border || '#e5e7eb';
  const accent =
    allColors.find((color) => color.name === 'primary') ||
    allColors.find((color) => !isNeutralColor(color.hex)) ||
    allColors[0];
  const accentHex = accent?.hex ?? '#6366f1';
  const secondAccentHex =
    designSystem.colors['primary-active'] ||
    designSystem.colors['accent-coral'] ||
    designSystem.colors['accent-teal'] ||
    (allColors.filter((color) => !isNeutralColor(color.hex))[1] ?? allColors[1])?.hex ||
    accentHex;

  return {
    brandName,
    allColors,
    fontFamily,
    resolvedDescription,
    canvasHex,
    surfaceHex,
    inkHex,
    bodyHex,
    borderHex,
    accentHex,
    accentText: getReadableTextColor(accentHex),
    secondAccentHex,
  };
}

function extractFrontmatter(content: string) {
  if (!content.startsWith('---\n')) {
    return '';
  }

  const rest = content.slice(4);
  const closingIndex = rest.search(/\n---\n?/);

  if (closingIndex === -1) {
    return rest.trimEnd();
  }

  return rest.slice(0, closingIndex);
}

function extractDesignSystemColors(content: string): DesignSystemColorEntry[] {
  const seen = new Set<string>();
  const colors: DesignSystemColorEntry[] = [];

  const addColor = (name: string, hex: string) => {
    const normalizedHex = hex.toLowerCase();
    if (!seen.has(normalizedHex)) {
      seen.add(normalizedHex);
      colors.push({ name, hex: normalizedHex });
    }
  };

  const patternWithCode = /\*\*([^*\n]+?)\*\*\s*\(`(#[0-9a-fA-F]{6})`\)/g;
  let match: RegExpExecArray | null;
  while ((match = patternWithCode.exec(content)) !== null) {
    addColor(match[1].trim(), match[2]);
  }

  const patternWithInlineHex = /\*\*([^*\n]+?)\s+\((#[0-9a-fA-F]{6})\)\*\*/g;
  while ((match = patternWithInlineHex.exec(content)) !== null) {
    addColor(match[1].trim(), match[2]);
  }

  if (colors.length < 3) {
    const fallbackPattern = /`(#[0-9a-fA-F]{6})`/g;
    while ((match = fallbackPattern.exec(content)) !== null) {
      addColor(match[1], match[1]);
      if (colors.length >= 8) {
        break;
      }
    }
  }

  return colors.slice(0, 10);
}

function extractDesignSystemFontFamily(content: string): string | null {
  let match = content.match(/(?:font[\s-]?famil(?:y|ies)|primary font|typeface)[:\s]+\*\*([^*]+)\*\*/i);
  if (match) {
    return match[1].trim().replace(/\s+\([^)]+\)$/, '');
  }

  match = content.match(
    /\*\*([^*]{4,50}(?:VF|Variable|Grotesk|Gothic|Round|Mono|Cereal|Neue|Nunito|Inter|Geist|Söhne|Manuka|SST|Degular)(?:[^*]*)?)\*\*\s*(?:\([^)]*primary[^)]*\))?/i,
  );
  if (match) {
    return match[1].trim().replace(/\s+\([^)]+\)$/, '');
  }

  return null;
}

function getReadableTextColor(backgroundHex: string): string {
  return getContrastRatio(backgroundHex, '#ffffff') >= getContrastRatio(backgroundHex, '#111111')
    ? '#ffffff'
    : '#111111';
}

function getContrastRatio(colorA: string, colorB: string): number {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

function getRelativeLuminance(hex: string): number {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function isNeutralColor(hex: string): boolean {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max - min < 20;
}

function stripFrontmatter(content: string) {
  if (!content.startsWith('---\n')) {
    return content.trim();
  }

  const rest = content.slice(4);
  const closingIndex = rest.search(/\n---\n?/);

  if (closingIndex === -1) {
    return '';
  }

  const closingMatch = rest.slice(closingIndex).match(/^\n---\n?/);
  const bodyStartIndex = closingIndex + (closingMatch?.[0].length ?? 0);
  return rest.slice(bodyStartIndex).trim();
}

function parseYamlLikeObject(input: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }];

  for (const rawLine of input.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      continue;
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1]!.value;

    if (!rawValue) {
      const nestedValue: Record<string, unknown> = {};
      current[key] = nestedValue;
      stack.push({ indent, value: nestedValue });
      continue;
    }

    current[key] = stripWrappingQuotes(rawValue);
  }

  return root;
}

function extractMarkdownSections(content: string) {
  const sections: Record<string, string> = {};
  const matches = [...content.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+.+\n|$)/gm)];

  for (const match of matches) {
    const title = match[1]?.trim();
    const sectionContent = match[2]?.trim();

    if (title && sectionContent) {
      sections[title] = sectionContent;
    }
  }

  return sections;
}

function getFirstSectionContent(sections: Record<string, string>) {
  return Object.values(sections)[0];
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getStringMap(value: unknown): TokenMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === 'string')
      .map(([key, item]) => [key, item as string]),
  );
}

function getNestedStringMap(value: unknown): NestedTokenMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item))
      .map(([key, item]) => [key, getStringMap(item)]),
  );
}

function stripWrappingQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, '').trim();
}
