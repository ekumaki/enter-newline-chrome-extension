# enter-newline-chrome-extension

ChatGPT Web版でのEnterキー誤送信を防ぐChrome拡張機能です。

## 機能

- **Enter**: 改行のみ（送信しない）
- **Ctrl/Cmd + Enter**: メッセージ送信（既定動作を維持）
- **Shift + Enter**: 改行（既定動作を維持）

## 対象サイト

- https://chatgpt.com/*

## インストール方法

### GitHubリリースから（推奨）

1. [Releases](https://github.com/ekumaki/enter-newline-chrome-extension/releases)から最新の `enter-newline-chrome-extension-v*.zip` をダウンロード
2. zipファイルを任意のフォルダに解凍
3. Chromeで `chrome://extensions/` を開く
4. 右上の「デベロッパーモード」をオンにする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. 解凍したフォルダを選択する
7. chatgpt.comで拡張機能が有効になります

### 開発者モードでのインストール（ソースから）

1. このリポジトリをクローン:
   ```bash
   git clone https://github.com/ekumaki/enter-newline-chrome-extension.git
   ```
2. Chromeで `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」をオンにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. クローンしたフォルダを選択する

### アイコン生成（オプション）

PNGアイコンが必要な場合は、`icon-generator.html` をブラウザで開いてアイコンをダウンロードできます。

## 技術仕様

- **Manifest**: V3
- **最小Chrome版本**: 138
- **権限**: scripting のみ
- **ファイル構成**:
  ```
  enter-newline-chrome-extension/
  ├─ manifest.json
  ├─ content.js
  ├─ icons/
  │  └─ icon128.svg
  ├─ README.md
  ├─ REQUIREMENTS.md
  └─ icon-generator.html
  ```

## 動作原理

1. `id="prompt-textarea"` 要素を監視
2. Enterキーのkeydownイベントをキャプチャフェーズで捕捉
3. Enter単体の場合は `preventDefault()` で送信を阻止し、`insertLineBreak` で改行を挿入
4. Ctrl/Cmd+Enter、Shift+Enterは既定動作を維持
5. MutationObserverでDOMの変更を監視し、動的に生成される要素にも対応

## テスト項目

- [ ] PC画面幅でEnterキー押下時に改行のみされること
- [ ] Ctrl+Enterで送信されること
- [ ] Shift+Enterで改行されること
- [ ] モバイル画面幅では影響しないこと
- [ ] 他の入力要素には影響しないこと
- [ ] ChatGPT UI再レンダリング後も動作すること

## ライセンス

MIT License

## 開発情報

詳細な要件定義は `REQUIREMENTS.md` を参照してください。