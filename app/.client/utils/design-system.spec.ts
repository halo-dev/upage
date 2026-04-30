import { describe, expect, it } from 'vitest';
import { buildDesignSystemPreviewModel, extractBrandNameFromDesignMd, parseDesignSystem } from './design-system';

describe('design-system', () => {
  it('should parse frontmatter tokens before the closing fence arrives', () => {
    const designSystem = parseDesignSystem(`---
name: Aurora
colors:
  primary: "#111827"
  accent: "#7c3aed"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6`);

    expect(designSystem.name).toBe('Aurora');
    expect(designSystem.colors.primary).toBe('#111827');
    expect(designSystem.colors.accent).toBe('#7c3aed');
    expect(designSystem.typography.body?.fontFamily).toBe('Inter');
  });

  it('should extract brand name from an unfinished frontmatter block', () => {
    expect(
      extractBrandNameFromDesignMd(`---
name: Aurora
colors:
  primary: "#111827"`),
    ).toBe('Aurora');
  });

  it('should fall back to the heading brand name when frontmatter is absent', () => {
    expect(
      extractBrandNameFromDesignMd(`# Acme Design System

## Colors
- Primary: \`#111827\``),
    ).toBe('Acme');
  });

  it('should build preview model from parsed tokens', () => {
    const preview = buildDesignSystemPreviewModel(
      `---
name: Aurora
description: Calm and modern.
colors:
  primary: "#111827"
  canvas: "#faf9f5"
  surface-card: "#ffffff"
  ink: "#101828"
  body: "#475467"
  hairline: "#e4e7ec"
typography:
  body-md:
    fontFamily: Inter
---
# Aurora Design System`,
      'fallback',
    );

    expect(preview.brandName).toBe('Aurora');
    expect(preview.resolvedDescription).toBe('Calm and modern.');
    expect(preview.fontFamily).toBe('Inter');
    expect(preview.canvasHex).toBe('#faf9f5');
    expect(preview.accentHex).toBe('#111827');
  });
});
