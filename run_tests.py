#!/usr/bin/env python3
"""
テスト実行スクリプト - うちなーらいふ不動産スクレイピングシステム

全てのテストを実行し、結果を表示します。
"""

import unittest
import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_all_tests():
    """全てのテストを実行"""
    
    print("="*70)
    print("うちなーらいふ不動産スクレイピングシステム - テスト実行")
    print("="*70)
    print()
    
    # テストディレクトリからテストを検出
    loader = unittest.TestLoader()
    tests_dir = os.path.join(os.path.dirname(__file__), 'tests')
    suite = loader.discover(tests_dir, pattern='test_*.py')
    
    # テストランナーを作成
    runner = unittest.TextTestRunner(verbosity=2)
    
    # テストを実行
    result = runner.run(suite)
    
    # 結果サマリー
    print()
    print("="*70)
    print("テスト結果サマリー")
    print("="*70)
    print(f"実行テスト数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失敗: {len(result.failures)}")
    print(f"エラー: {len(result.errors)}")
    print("="*70)
    
    # 終了コード
    if result.wasSuccessful():
        print("\n✅ 全てのテストが成功しました！")
        return 0
    else:
        print("\n❌ 一部のテストが失敗しました。")
        return 1


if __name__ == '__main__':
    sys.exit(run_all_tests())

