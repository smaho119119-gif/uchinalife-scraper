/**
 * Standard-template image mode → layout instructions.
 *
 * Lookup table replacing the previous if/else if chain inside `lib/ai.ts`
 * (`generatePropertyImageWithPhotos`, `template === 'standard'` branch).
 *
 * Adding a new mode now means appending an entry here. Output strings are
 * intentionally byte-identical to the previous inline version so AI
 * generations remain reproducible.
 */

export const STANDARD_MODE_INSTRUCTIONS = {
    youtube: `
【YouTubeサムネイル風レイアウト】
- 16:9のワイドフォーマット
- 大きく目を引くタイトル文字（太字、縁取り付き）
- 物件写真を背景全面に配置
- 価格を目立つ位置に大きく表示（黄色やオレンジなどの注目色）
- 「詳細はこちら」などのCTAテキスト`,

    stories: `
【Instagramストーリーズ風レイアウト】
- 9:16の縦長フォーマット
- 物件写真を全面に配置
- 上部にタイトル、中央に価格
- 下部に「スワイプアップ」などのCTAエリア
- ストーリーズに適したポップなデザイン`,

    instagram: `
【Instagram投稿風レイアウト】
- 1:1の正方形フォーマット
- 物件写真をメインに配置
- 洗練されたタイポグラフィ
- ハッシュタグ風の装飾も可
- インスタ映えするスタイリッシュなデザイン`,

    sns_banner: `
【SNSバナー風レイアウト】
- 物件写真を背景に配置
- 上部に物件名（大きく読みやすく）
- 中央または目立つ位置に価格
- 下部に物件詳細と問い合わせボタン
- SNS広告に適したデザイン`,
} as const;

export type StandardImageMode = keyof typeof STANDARD_MODE_INSTRUCTIONS;

/**
 * Resolves the mode-specific instructions block. Unknown modes fall back to
 * `sns_banner` so the previous behavior (default branch) is preserved.
 */
export function getStandardModeInstructions(mode: string): string {
    return (
        (STANDARD_MODE_INSTRUCTIONS as Record<string, string>)[mode]
        ?? STANDARD_MODE_INSTRUCTIONS.sns_banner
    );
}
