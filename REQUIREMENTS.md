# enter-newline-chrome-extension 要件定義書

## 0. ドキュメント情報

| 項目 | 内容 |
|------|------|
| 文書名 | enter-newline-chrome-extension 要件定義書 |
| 作成日 | 2025-07-31 |
| 作成者 | ChatGPT（o3） |
| 版数 | v1.0 Draft |

## 1. 背景・目的

ChatGPT Web 版（https://chatgpt.com/）では PC 画面幅 > 768 px の場合、Enter キー単体で即送信される既定仕様のため、長文を作成中に誤送信するリスクがある。本拡張機能は

- Enter ＝ 改行のみ
- Ctrl/Cmd + Enter ＝ 送信（既定動作を維持）

というキーアサインへ最小限の介入を行い、誤爆防止と下書き入力の快適性を向上させることを目的とする。

## 2. スコープ

| 項目 | 内容 |
|------|------|
| 対象システム | https://chatgpt.com/ にホストされる ChatGPT Web UI（2025 年 7 月時点 DOM 仕様） |
| 対象ブラウザ | Google Chrome 139 以降（最低 138 をサポート） |
| 配布形態 | Chrome 拡張 (Manifest V3)／Chrome ウェブストア公開無し。crx ファイルまたは展開フォルダで手動インストール |
| 除外 | chat.openai.com、モバイルアプリ、他社サイト、Edge/Firefox 等の互換ブラウザ |

## 3. 用語定義

| 用語 | 定義 |
|------|------|
| ChatUI | 本拡張が対象とする ChatGPT のフロントエンド SPA |
| PromptTextarea | id="prompt-textarea" を持つ contenteditable="true" の入力要素。本書では略称 PTA と表記 |
| 送信ボタン | button[data-testid="send-button"] 要素。アイコン付きボタン |
| 本拡張 | enter-newline-chrome-extension |

## 4. 既存仕様調査（2025-07 時点）

### 4.1 PTA DOM 概要

```html
<textarea style="display:none" data-virtualkeyboard="true"></textarea>
<div id="prompt-textarea" contenteditable="true" class="max-h-52 ...">
  <p data-placeholder="Message ChatGPT" class="placeholder"><br></p>
</div>
```

- PTA は contenteditable div であり、同 ID のままテキストエリアから移行済み。
- 親ラッパーは高さ制限 (max-h-52) と overflow-auto を持つ。
- 隣接して送信ボタン・ファイル添付ボタンなどが同じ composer コンテナに存在。

### 4.2 既定キー挙動まとめ

| 状態 | Enter | Shift+Enter | Ctrl/Cmd+Enter |
|------|-------|-------------|----------------|
| 画面幅 > 768 px | 送信 | 改行 | 送信 (代替) |
| 画面幅 ≤ 768 px | 改行 | 改行 | 送信 |
| 編集モード | 改行 | 改行 | 送信 (確定) |

### 4.3 イベントフロー

- keydown → keypress (廃止予定) → keyup
- ChatUI は keydown 段階で送信処理を行い event.preventDefault() で改行を抑止。
- Ctrl/Cmd+Enter も keydown レベルで受理され送信実行。

### 4.4 課題

- 誤送信防止には Enter のみ を抑止すれば十分。
- Ctrl/Cmd+Enter は利用者が明示的に押すため誤爆リスクは低い → 既定維持が望ましい。

## 5. 要件

### 5.1 機能要件 (FR)

| 番号 | 要件 | 優先度 |
|------|------|--------|
| FR-1 | PTA フォーカス時、Enter 単体押下で改行 (newline) を挿入し、送信を行わない | Must |
| FR-2 | Ctrl/Cmd + Enter 押下で送信（ChatUI 既定動作を阻害しない） | Must |
| FR-3 | Shift + Enter 押下で改行（既定動作維持） | Must |
| FR-4 | その他すべてのキー入力・ショートカットは ChatUI 既定動作を変更しない | Must |
| FR-5 | 入力エリアが再生成されても本拡張の動作を自動復元する | Should |

### 5.2 非機能要件 (NFR)

| 番号 | 要件 | 優先度 |
|------|------|--------|
| NFR-1 | Manifest V3 準拠。Chrome 138 以降で動作 | Must |
| NFR-2 | 外部ライブラリに依存しない（バンドラ不要）。プレーン JS / CSS のみ | Must |
| NFR-3 | UI 追加なし（オプションページ・ポップアップなし）。インストールのみで有効/無効を切替 | Must |
| NFR-4 | 実行時オーバーヘッドは 1 ms 未満／イベント。メモリリークがないこと | Should |
| NFR-5 | セキュリティ：コンテンツスクリプトのみで動作し、バックグラウンド権限を要求しない | Must |
| NFR-6 | ライセンス：MIT としヘッダコメントへ明記 | Should |

## 6. システム設計方針

### 6.1 ファイル構成

```
enter-newline-chrome-extension/
├─ manifest.json
├─ content.js
└─ icons/
   └─ icon128.png (任意)
```

### 6.2 manifest.json (例)

```json
{
  "name": "enter-newline-chrome-extension",
  "version": "1.0.0",
  "description": "Press Enter to insert newline, Ctrl+Enter to send on chatgpt.com.",
  "manifest_version": 3,
  "action": {"default_icon": "icons/icon128.png"},
  "permissions": ["scripting"],
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "minimum_chrome_version": "138"
}
```

### 6.3 content.js 主要ロジック

```javascript
// 1. 監視対象 ID
const PTA_ID = 'prompt-textarea';

// 2. イベントハンドラ
function interceptEnter(e) {
  if (e.key !== 'Enter') return;
  if (e.ctrlKey || e.metaKey) return;      // Ctrl/Cmd+Enter → 既定送信
  if (e.shiftKey) return;                 // Shift+Enter → 既定改行

  // ↓ Enter 単体を改行化
  e.preventDefault();
  e.stopPropagation();
  document.execCommand('insertLineBreak');
  e.target.dispatchEvent(new Event('input', {bubbles: true}));
}

// 3. リスナー登録
function attach(elem) {
  if (!elem.__enter2newline_listener__) {
    elem.addEventListener('keydown', interceptEnter, true); // capture phase
    elem.__enter2newline_listener__ = true;
  }
}

// 4. 初期化 & MutationObserver
function init() {
  const el = document.getElementById(PTA_ID);
  if (el) attach(el);
}
init();

new MutationObserver(muts => {
  muts.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === 1) {
        if (node.id === PTA_ID) attach(node);
        // 入力エリアがラップ内で置換されたケースも想定
        const inner = node.querySelector && node.querySelector(`#${PTA_ID}`);
        if (inner) attach(inner);
      }
    });
  });
}).observe(document.body, {childList: true, subtree: true});
```

## 7. テスト観点

| テスト ID | シナリオ | 期待結果 |
|-----------|----------|----------|
| T-1 | 画面幅 1920px、PTA フォーカス中に Enter | 改行のみ（送信されない） |
| T-2 | 同条件で Ctrl+Enter | メッセージ送信される |
| T-3 | 同条件で Shift+Enter | 改行される |
| T-4 | ブラウザ幅 600px（モバイル幅）で Enter | 改行（既定も改行だが拡張が干渉しない） |
| T-5 | 編集モードで Enter | 改行（既定動作） |
| T-6 | ChatGPT UI 再レンダ後に Enter | 改行（MutationObserver により復帰） |
| T-7 | 非 PTA 要素（検索入力）に Enter | 既定動作（送信/改行いずれも拡張は無干渉） |

## 8. セキュリティ・パフォーマンス

- content.js のみで動作し、ストレージ・Cookie 等の権限要求なし。
- 監視対象を PTA に限定し、グローバルな keydown は capture フェーズで早期 return。
- MutationObserver は observe(document.body, {subtree:true, childList:true}) で負荷最小化。

## 9. 保守・拡張性

- PTA の ID 変更時は PTA_ID を差し替えることで対応。
- ChatGPT が contenteditable → textarea 等へ戻った場合でも ID のみ確認し、新旧双方で改行挿入ロジックが動作するよう要テスト。
- 追加ショートカット（例：Alt+Enter）のユーザ要望があれば interceptEnter 内条件を拡張。

## 10. リスクと対応策

| リスク | 影響 | 対応策 |
|--------|------|--------|
| ChatGPT 側の大幅な DOM 改修 | 拡張未動作 | MutationObserver + セレクター見直しガイドを README に記載し、バージョンアップで追随 |
| 二重送信 | 誤動作・重複チャージ | Ctrl/Cmd+Enter を未干渉にし、Enter改行時は確実に preventDefault で送信抑止 |
| Chrome Manifest 制約変更 | ストア登録時に警告 | Manifest V3 ガイドライン準拠 + 不要 API 不使用 |

## 11. 付録

### 11.1 参考コード（GreasyFork ユーザースクリプト抜粋）

- stopImmediatePropagation() により ChatGPT 既存リスナーをブロック
- textarea.value += "\n" → dispatchEvent('input') で高さ再計算トリガ

### 11.2 変更履歴

| 版数 | 日付 | 変更点 |
|------|------|--------|
| v0.1 | 2025-07-31 | 初版ドラフト作成 |
| v1.0 | — | 利用者レビュー後に確定版リリース予定 |

以上