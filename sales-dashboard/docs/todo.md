# TODO (Bug Hunt Rounds)

## Round 2 候補
- [ ] `admin/page.tsx` 分割（最低でも Stats / Workflow / Calendar / ImageGallery / Logs）
- [ ] 削除系UIに `Dialog` 確認 (proposal builder, etc)
- [ ] `propertyCache` の serverless 非互換の最終撲滅
- [ ] 緯度経度マップを `lib/coordinates.ts` に集約
- [ ] `any` を `unknown` + 型ガードへ段階的に置換
- [ ] InteractiveMap.tsx 738行 → useMapData / useMapFilters 分割
- [ ] アクセシビリティ（aria-label, alt, focus-visible）監査
- [ ] E2E 主要シナリオ (login → /sales/area-analysis → 提案書生成) のスモークテスト
- [ ] Round 1 の修正に対する副作用回帰テスト
