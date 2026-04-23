/**
 * AI image style → English style description.
 *
 * Lookup table replacing the previous switch/case in lib/ai.ts.
 * Adding a new style now means appending a single entry here, with the
 * key visible to TypeScript so callers can autocomplete.
 *
 * Keys are intentionally kept in sync with the values used by the
 * ImageGenerator UI dropdown.
 */

export const AI_STYLE_DESCRIPTIONS = {
    luxury: 'elegant gold and black with premium textures',
    modern: 'clean white and blue with minimalist design',
    classic: 'warm beige and brown with traditional elegance',
    minimal: 'monochrome with lots of white space',
    handdrawn:
        'colorful hand-drawn illustration style with playful sketchy lines and vibrant colors',
    '3d':
        'photorealistic 3D rendering with depth, shadows, and modern CGI aesthetic',
    watercolor:
        'soft watercolor painting style with gentle color blends and artistic brush strokes',
    neon:
        'vibrant neon colors with glowing effects, cyberpunk aesthetic, and electric atmosphere',
    vintage:
        'retro vintage style with aged paper texture, sepia tones, and classic typography',
    futuristic:
        'sleek futuristic design with metallic elements, holographic effects, and sci-fi aesthetic',
    business:
        'professional Japanese business presentation style with clean infographics, charts, and structured layout',
    anime:
        'Japanese anime illustration style with vibrant colors and expressive characters',
} as const;

export type AiStyleKey = keyof typeof AI_STYLE_DESCRIPTIONS;

const DEFAULT_STYLE_DESCRIPTION = 'warm neutral tones';

export function getStyleDescription(style: string): string {
    return (
        (AI_STYLE_DESCRIPTIONS as Record<string, string>)[style] ??
        DEFAULT_STYLE_DESCRIPTION
    );
}
