/**
 * Tiptap Notion-style Editor Initialization
 * 노션 스타일 블록 에디터
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';

// Register languages
lowlight.registerLanguage('javascript', javascript);
lowlight.registerLanguage('python', python);
lowlight.registerLanguage('java', java);
lowlight.registerLanguage('cpp', cpp);
lowlight.registerLanguage('html', html);
lowlight.registerLanguage('css', css);

class NotionEditor {
  constructor(options = {}) {
    this.options = {
      element: options.element || '#editor',
      placeholder: options.placeholder || '내용을 입력하세요... / 를 눌러 명령어 보기',
      uploadEndpoint: options.uploadEndpoint || '/upload/image',
      autosave: options.autosave !== false,
      initialContent: options.initialContent || null,
      onUpdate: options.onUpdate || null,
      ...options
    };

    this.editor = null;
    this.autosaveTimer = null;
  }

  init() {
    const editorElement = typeof this.options.element === 'string'
      ? document.querySelector(this.options.element)
      : this.options.element;

    if (!editorElement) {
      console.error('[Tiptap] Editor element not found:', this.options.element);
      return;
    }

    this.editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          codeBlock: false, // Use custom code block with syntax highlighting
          heading: {
            levels: [1, 2, 3, 4]
          }
        }),
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') {
              return '제목을 입력하세요';
            }
            return this.options.placeholder;
          }
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'javascript'
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: {
            class: 'editor-image'
          }
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: 'editor-table'
          }
        }),
        TableRow,
        TableHeader,
        TableCell
      ],
      content: this.options.initialContent,
      editorProps: {
        attributes: {
          class: 'notion-editor-content'
        }
      },
      onUpdate: ({ editor }) => {
        this.handleUpdate(editor);
      }
    });

    console.log('[Tiptap] Editor initialized');
    return this.editor;
  }

  handleUpdate(editor) {
    // Custom onUpdate callback
    if (this.options.onUpdate) {
      this.options.onUpdate(editor);
    }

    // Autosave functionality
    if (this.options.autosave) {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer);
      }

      this.autosaveTimer = setTimeout(() => {
        this.saveDraft();
      }, 3000); // 3초 후 자동 저장
    }
  }

  async saveDraft() {
    try {
      const json = this.editor.getJSON();
      const html = this.editor.getHTML();

      // LocalStorage에 임시 저장
      const draftKey = `blog_draft_${this.options.postId || 'new'}`;
      localStorage.setItem(draftKey, JSON.stringify({
        json,
        html,
        savedAt: new Date().toISOString()
      }));

      console.log('[Tiptap] Draft saved to localStorage');

      // UI 업데이트
      this.showSaveStatus('저장됨');
    } catch (error) {
      console.error('[Tiptap] Draft save failed:', error);
      this.showSaveStatus('저장 실패', true);
    }
  }

  showSaveStatus(message, isError = false) {
    const statusElement = document.getElementById('saveStatus');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = isError ? 'text-danger' : 'text-success';

      setTimeout(() => {
        statusElement.textContent = '';
      }, 2000);
    }
  }

  // 이미지 업로드 헬퍼
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(this.options.uploadEndpoint, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success && result.url) {
        return result.url;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('[Tiptap] Image upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
      return null;
    }
  }

  // 이미지 삽입
  addImage(url) {
    if (url && this.editor) {
      this.editor.chain().focus().setImage({ src: url }).run();
    }
  }

  // 링크 추가
  setLink() {
    const url = prompt('링크 URL을 입력하세요:');
    if (url) {
      this.editor.chain().focus().setLink({ href: url }).run();
    }
  }

  // 테이블 삽입
  insertTable() {
    this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  // 콘텐츠 가져오기
  getJSON() {
    return this.editor.getJSON();
  }

  getHTML() {
    return this.editor.getHTML();
  }

  getText() {
    return this.editor.getText();
  }

  // 콘텐츠 설정
  setContent(content) {
    this.editor.commands.setContent(content);
  }

  // 에디터 파괴
  destroy() {
    if (this.editor) {
      this.editor.destroy();
    }
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
  }

  // 초안 불러오기
  loadDraft() {
    const draftKey = `blog_draft_${this.options.postId || 'new'}`;
    const draft = localStorage.getItem(draftKey);

    if (draft) {
      try {
        const { json, savedAt } = JSON.parse(draft);
        const savedDate = new Date(savedAt);
        const now = new Date();
        const hoursDiff = (now - savedDate) / 1000 / 60 / 60;

        // 24시간 이내 초안만 복구
        if (hoursDiff < 24) {
          const restore = confirm(`${Math.floor(hoursDiff)}시간 전에 저장된 초안이 있습니다. 복구하시겠습니까?`);
          if (restore) {
            this.setContent(json);
            return true;
          }
        }
      } catch (error) {
        console.error('[Tiptap] Failed to load draft:', error);
      }
    }
    return false;
  }

  // 초안 삭제
  clearDraft() {
    const draftKey = `blog_draft_${this.options.postId || 'new'}`;
    localStorage.removeItem(draftKey);
  }
}

// Global export
window.NotionEditor = NotionEditor;
