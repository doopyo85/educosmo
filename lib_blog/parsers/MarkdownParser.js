/**
 * Markdown Parser
 * Markdown 파일을 파싱하여 블로그 포스트로 변환
 */

const matter = require('gray-matter');
const { marked } = require('marked');

class MarkdownParser {
  constructor() {
    // Marked 설정
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // 줄바꿈을 <br>로 변환
      highlight: function (code, lang) {
        // Syntax highlighting은 클라이언트에서 처리
        return code;
      }
    });
  }

  /**
   * Markdown 파일 파싱
   * @param {string} mdContent - Markdown 원본 텍스트
   * @returns {object} - 파싱된 데이터
   */
  parse(mdContent) {
    try {
      // 1. Front Matter 추출 (YAML 형식)
      const { data, content } = matter(mdContent);

      // 2. Markdown → HTML 변환
      const html = marked(content);

      // 3. 메타데이터 정리
      const metadata = {
        title: data.title || '제목 없음',
        tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
        difficulty: parseInt(data.difficulty) || 1,
        category: data.category || 'general',
        description: data.description || '',
        author: data.author || '',
        date: data.date || new Date().toISOString()
      };

      // 4. 텍스트 추출 (excerpt용)
      const text = this.extractText(html);
      const excerpt = text.substring(0, 200);

      // 5. 첫 번째 이미지 추출 (thumbnail용)
      const thumbnail = this.extractFirstImage(html);

      return {
        metadata,
        content: html,
        rawMarkdown: content,
        excerpt,
        thumbnail,
        wordCount: text.split(/\s+/).length,
        readingTime: Math.ceil(text.split(/\s+/).length / 200) // 분당 200단어 기준
      };
    } catch (error) {
      console.error('[MarkdownParser] Parse error:', error);
      throw new Error(`Markdown 파싱 실패: ${error.message}`);
    }
  }

  /**
   * HTML에서 텍스트 추출
   */
  extractText(html) {
    return html
      .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
      .replace(/\s+/g, ' ') // 공백 정규화
      .trim();
  }

  /**
   * 첫 번째 이미지 URL 추출
   */
  extractFirstImage(html) {
    const match = html.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
  }

  /**
   * Tiptap JSON 형식으로 변환 (선택사항)
   * Markdown을 Tiptap의 블록 구조로 변환
   */
  convertToTiptapJSON(mdContent) {
    const { data, content } = matter(mdContent);

    // 간단한 변환 (헤더, 단락, 리스트만 지원)
    const lines = content.split('\n');
    const blocks = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // 헤더 감지
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        blocks.push({
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text: headerMatch[2] }]
        });
        continue;
      }

      // 리스트 감지
      if (line.match(/^[-*+]\s+/)) {
        const text = line.replace(/^[-*+]\s+/, '');
        blocks.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text }]
            }]
          }]
        });
        continue;
      }

      // 일반 단락
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }]
      });
    }

    return {
      type: 'doc',
      content: blocks
    };
  }

  /**
   * Front Matter 예제 생성
   */
  static createTemplate() {
    return `---
title: 새로운 교안
description: 교안 설명을 입력하세요
tags: [python, 기초]
difficulty: 1
category: lecture
date: ${new Date().toISOString()}
---

# 교안 제목

여기에 내용을 작성하세요.

## 섹션 1

내용...

## 섹션 2

내용...
`;
  }

  /**
   * Markdown 유효성 검증
   */
  validate(mdContent) {
    if (!mdContent || typeof mdContent !== 'string') {
      throw new Error('유효한 Markdown 문자열이 아닙니다.');
    }

    if (mdContent.length > 500000) { // 500KB 제한
      throw new Error('파일 크기가 너무 큽니다 (최대 500KB).');
    }

    return true;
  }
}

module.exports = { MarkdownParser };
