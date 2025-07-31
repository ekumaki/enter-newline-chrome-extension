/*
 * MIT License
 * 
 * Copyright (c) 2025 enter-newline-chrome-extension
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function() {
  'use strict';

  // 監視対象 ID
  const PTA_ID = 'prompt-textarea';
  
  // IME入力中フラグ
  let isComposing = false;
  let recentCompositionEnd = false;

  // イベントハンドラ
  function interceptEnter(e) {
    if (e.key !== 'Enter') return;
    
    // Ctrl/Cmd+Enter → 既定動作を維持（何もしない）
    if (e.ctrlKey || e.metaKey) return;
    
    // Shift+Enter → 既定の改行動作を維持
    if (e.shiftKey) return;
    
    
    // IME入力中の場合は何もしない（確定処理に任せる）
    if (isComposing || e.isComposing) return;
    
    // IME確定直後の場合は改行処理を実行（送信を阻止）
    if (recentCompositionEnd) {
      recentCompositionEnd = false;
    }

    // Enter 単体を改行化 - 最初にイベント伝播を完全に阻止
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    
    
    // 非同期で改行処理を実行してChatGPT側の後処理を回避
    setTimeout(() => {
      performNewlineInsertion(e.target);
      
      // ProseMirrorが改行を削除する可能性があるため、再確認と再挿入
      setTimeout(() => {
        const brElements = e.target.querySelectorAll('br');
        if (brElements.length === 0) {
          performNewlineInsertion(e.target);
        }
      }, 50);
    }, 10);
  }
  
  // 改行挿入処理を独立した関数に分離  
  function performNewlineInsertion(target) {
    try {
      // 方法1: Selection API を使用
      const selection = window.getSelection();
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // ProseMirror対応: より確実な改行挿入方法
        const br = document.createElement('br');
        
        // 選択範囲が折りたたまれている（カーソル位置）場合のみ改行を挿入
        if (range.collapsed) {
          // 改行要素を挿入
          range.insertNode(br);
          
          // ProseMirrorが削除しにくくするため、br要素の後に空のテキストノードを追加
          const emptyTextNode = document.createTextNode('');
          range.setStartAfter(br);
          range.insertNode(emptyTextNode);
          
          // カーソルを空のテキストノードに配置
          range.setStart(emptyTextNode, 0);
          range.setEnd(emptyTextNode, 0);
        } else {
          // テキストが選択されている場合は選択範囲を削除してから改行を挿入
          range.deleteContents();
          range.insertNode(br);
          
          const emptyTextNode = document.createTextNode('');
          range.setStartAfter(br);
          range.insertNode(emptyTextNode);
          
          range.setStart(emptyTextNode, 0);
          range.setEnd(emptyTextNode, 0);
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      
      // 方法2: document.execCommand を使用（非推奨だが互換性のため）
      try {
        document.execCommand('insertLineBreak');
      } catch (fallbackError) {
        
        // 方法3: 最後の手段として直接DOM操作
        try {
          const br = document.createElement('br');
          target.appendChild(br);
        } catch (finalError) {
        }
      }
    }
    
    // inputイベントを発火して高さ再計算をトリガー
    try {
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (inputError) {
    }
  }
  
  // IME状態管理ハンドラ
  function handleCompositionStart(e) {
    isComposing = true;
  }
  
  function handleCompositionEnd(e) {
    recentCompositionEnd = true;
    // IME確定処理が完了するまで少し待つ
    setTimeout(() => {
      isComposing = false;
    }, 10);
  }

  // リスナー登録
  function attach(elem) {
    if (!elem.__enter2newline_listener__) {
      elem.addEventListener('keydown', interceptEnter, true); // capture phase
      elem.addEventListener('compositionstart', handleCompositionStart, true);
      elem.addEventListener('compositionend', handleCompositionEnd, true);
      elem.__enter2newline_listener__ = true;
    }
  }

  // 初期化
  function init() {
    const el = document.getElementById(PTA_ID);
    if (el) attach(el);
  }

  // 初期化実行
  init();

  // MutationObserver でDOM変更を監視
  new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          if (node.id === PTA_ID) {
            attach(node);
          }
          // 入力エリアがラップ内で置換されたケースも想定
          const inner = node.querySelector && node.querySelector(`#${PTA_ID}`);
          if (inner) {
            attach(inner);
          }
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

})();