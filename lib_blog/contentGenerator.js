/**
 * Blog Content Generator
 * 프로젝트 제출 및 학습 활동을 블로그 콘텐츠로 자동 생성
 */

const { queryDatabase } = require('../lib_login/db');

class BlogContentGenerator {
  /**
   * 프로젝트 제출 시 블로그 글 자동 생성
   * @param {number} submissionId - ProjectSubmissions.id
   */
  async generateProjectPost(submissionId) {
    try {
      console.log(`[ContentGenerator] 프로젝트 ${submissionId} 블로그 글 생성 시작`);

      // 1. 프로젝트 제출 정보 조회
      const [submission] = await queryDatabase(
        `SELECT * FROM ProjectSubmissions WHERE id = ?`,
        [submissionId]
      );

      if (!submission) {
        console.error(`[ContentGenerator] 제출 정보를 찾을 수 없음: ${submissionId}`);
        return false;
      }

      // 2. 사용자 블로그 조회
      const [userBlog] = await queryDatabase(
        `SELECT id, subdomain FROM user_blogs WHERE user_id = ?`,
        [submission.user_id]
      );

      if (!userBlog) {
        console.log(`[ContentGenerator] 사용자 ${submission.user_id}의 블로그가 없음 (스킵)`);
        return false;
      }

      // 3. 메타데이터 파싱
      let metadata = {};
      try {
        metadata = JSON.parse(submission.metadata || '{}');
      } catch (e) {
        console.warn(`[ContentGenerator] 메타데이터 파싱 실패: ${submissionId}`);
      }

      const analysis = metadata.analysis || {};

      // 4. Tiptap JSON 블록 구성
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: submission.project_name }]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `🎮 플랫폼: ${submission.platform}` },
              { type: 'text', text: ' | ' },
              { type: 'text', text: `📅 제작일: ${new Date(submission.created_at).toLocaleDateString()}` }
            ]
          }
        ]
      };

      // 썸네일 이미지 추가
      if (submission.thumbnail_url) {
        content.content.push({
          type: 'image',
          attrs: {
            src: submission.thumbnail_url,
            alt: submission.project_name,
            title: '프로젝트 실행 화면'
          }
        });
      }

      // 분석 정보 추가 (있는 경우)
      if (analysis.blocks) {
        content.content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📦 프로젝트 정보' }]
        });

        content.content.push({
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: `사용한 블록 수: ${analysis.blocks}개` }]
              }]
            }
          ]
        });

        if (analysis.duration) {
          content.content[content.content.length - 1].content.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: `제작 시간: ${analysis.duration}` }]
            }]
          });
        }
      }

      // 설명 추가 (있는 경우)
      if (submission.description) {
        content.content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📝 설명' }]
        });

        content.content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: submission.description }]
        });
      }

      // 푸터 추가
      content.content.push({
        type: 'horizontalRule'
      });

      content.content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '이 글은 프로젝트 제출 시 자동으로 생성되었습니다. ', marks: [{ type: 'italic' }] },
          { type: 'text', text: '✨ MyUniverse', marks: [{ type: 'italic' }] }
        ]
      });

      // 5. HTML 생성 (fallback용)
      const html = this.generateHTMLFromJSON(content);

      // 6. 텍스트 추출 (excerpt용)
      const text = this.extractTextFromJSON(content);
      const excerpt = text.substring(0, 200);

      // 7. slug 생성
      const slug = `auto-${Date.now()}-${submission.id}`;

      // 8. blog_posts에 삽입
      await queryDatabase(
        `INSERT INTO blog_posts
        (blog_id, blog_type, author_id, title, slug, content, content_json, excerpt, thumbnail_url, is_published, created_at, updated_at)
        VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          userBlog.id,
          submission.user_id,
          `[자동생성] ${submission.project_name}`,
          slug,
          html,
          JSON.stringify(content),
          excerpt,
          submission.thumbnail_url || null
        ]
      );

      console.log(`[ContentGenerator] 블로그 글 생성 완료: ${slug}`);
      return true;
    } catch (error) {
      console.error(`[ContentGenerator] 프로젝트 ${submissionId} 블로그 글 생성 실패:`, error);
      return false;
    }
  }

  /**
   * 주간 학습 리포트 자동 생성
   * @param {number} userId - Users.id
   */
  async generateWeeklyReport(userId) {
    try {
      console.log(`[ContentGenerator] 사용자 ${userId} 주간 리포트 생성 시작`);

      // 1. 사용자 블로그 조회
      const [userBlog] = await queryDatabase(
        `SELECT id, subdomain FROM user_blogs WHERE user_id = ?`,
        [userId]
      );

      if (!userBlog) {
        console.log(`[ContentGenerator] 사용자 ${userId}의 블로그가 없음 (스킵)`);
        return false;
      }

      // 2. 최근 7일간 학습 활동 조회
      const activities = await queryDatabase(
        `SELECT platform, COUNT(*) as count, SUM(duration_minutes) as total_time
        FROM LearningLogs
        WHERE user_id = ? AND start_time > DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY platform
        ORDER BY count DESC`,
        [userId]
      );

      if (activities.length === 0) {
        console.log(`[ContentGenerator] 사용자 ${userId}의 최근 활동이 없음 (스킵)`);
        return false;
      }

      // 3. 총 통계 계산
      const totalCount = activities.reduce((sum, a) => sum + a.count, 0);
      const totalTime = activities.reduce((sum, a) => sum + (a.total_time || 0), 0);

      // 4. Tiptap JSON 블록 구성
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '📊 이번 주 학습 기록' }]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `${new Date().toLocaleDateString()} 기준` }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '✨ 이번 주 요약' }]
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `총 ${totalCount}회의 학습 활동` }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `${activities.length}개 플랫폼 사용` }]
                }]
              }
            ]
          }
        ]
      };

      if (totalTime > 0) {
        content.content[content.content.length - 1].content.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: `총 학습 시간: ${totalTime}분` }]
          }]
        });
      }

      // 5. 플랫폼별 활동 테이블
      content.content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '📈 플랫폼별 활동' }]
      });

      const tableRows = [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '플랫폼' }] }]
            },
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '활동 횟수' }] }]
            },
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '학습 시간' }] }]
            }
          ]
        }
      ];

      for (const activity of activities) {
        tableRows.push({
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: activity.platform }] }]
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: `${activity.count}회` }] }]
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: `${activity.total_time || 0}분` }] }]
            }
          ]
        });
      }

      content.content.push({
        type: 'table',
        content: tableRows
      });

      // 푸터
      content.content.push({
        type: 'horizontalRule'
      });

      content.content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '이 리포트는 매주 자동으로 생성됩니다. ', marks: [{ type: 'italic' }] },
          { type: 'text', text: '✨ MyUniverse Observatory', marks: [{ type: 'italic' }] }
        ]
      });

      // 6. HTML 생성
      const html = this.generateHTMLFromJSON(content);

      // 7. 텍스트 추출
      const text = this.extractTextFromJSON(content);
      const excerpt = text.substring(0, 200);

      // 8. slug 생성
      const slug = `weekly-report-${Date.now()}`;

      // 9. blog_posts에 삽입
      await queryDatabase(
        `INSERT INTO blog_posts
        (blog_id, blog_type, author_id, title, slug, content, content_json, excerpt, is_published, created_at, updated_at)
        VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          userBlog.id,
          userId,
          `이번 주 학습 요약 (${new Date().toLocaleDateString()})`,
          slug,
          html,
          JSON.stringify(content),
          excerpt
        ]
      );

      console.log(`[ContentGenerator] 주간 리포트 생성 완료: ${slug}`);
      return true;
    } catch (error) {
      console.error(`[ContentGenerator] 사용자 ${userId} 주간 리포트 생성 실패:`, error);
      return false;
    }
  }

  /**
   * Tiptap JSON → HTML 변환 (간단한 변환)
   */
  generateHTMLFromJSON(json) {
    if (!json || !json.content) return '';

    const renderNode = (node) => {
      if (!node) return '';

      switch (node.type) {
        case 'doc':
          return node.content?.map(renderNode).join('') || '';

        case 'heading':
          const level = node.attrs?.level || 2;
          const headingText = node.content?.map(n => n.text || '').join('') || '';
          return `<h${level}>${headingText}</h${level}>`;

        case 'paragraph':
          const pText = node.content?.map(n => {
            let text = n.text || '';
            if (n.marks) {
              n.marks.forEach(mark => {
                if (mark.type === 'bold') text = `<strong>${text}</strong>`;
                if (mark.type === 'italic') text = `<em>${text}</em>`;
                if (mark.type === 'code') text = `<code>${text}</code>`;
              });
            }
            return text;
          }).join('') || '';
          return `<p>${pText}</p>`;

        case 'image':
          const src = node.attrs?.src || '';
          const alt = node.attrs?.alt || '';
          return `<img src="${src}" alt="${alt}" class="editor-image" />`;

        case 'bulletList':
          const items = node.content?.map(renderNode).join('') || '';
          return `<ul>${items}</ul>`;

        case 'listItem':
          const itemContent = node.content?.map(renderNode).join('') || '';
          return `<li>${itemContent}</li>`;

        case 'table':
          const rows = node.content?.map(renderNode).join('') || '';
          return `<table class="editor-table">${rows}</table>`;

        case 'tableRow':
          const cells = node.content?.map(renderNode).join('') || '';
          return `<tr>${cells}</tr>`;

        case 'tableHeader':
          const thContent = node.content?.map(renderNode).join('') || '';
          return `<th>${thContent}</th>`;

        case 'tableCell':
          const tdContent = node.content?.map(renderNode).join('') || '';
          return `<td>${tdContent}</td>`;

        case 'horizontalRule':
          return '<hr />';

        case 'codeBlock':
          const code = node.content?.map(n => n.text || '').join('') || '';
          return `<pre><code>${code}</code></pre>`;

        case 'blockquote':
          const quoteContent = node.content?.map(renderNode).join('') || '';
          return `<blockquote>${quoteContent}</blockquote>`;

        default:
          return '';
      }
    };

    return renderNode(json);
  }

  /**
   * Tiptap JSON → Plain Text 추출
   */
  extractTextFromJSON(json) {
    if (!json || !json.content) return '';

    const extractText = (node) => {
      if (!node) return '';

      if (node.text) return node.text;

      if (node.content) {
        return node.content.map(extractText).join(' ');
      }

      return '';
    };

    return extractText(json).trim();
  }
}

module.exports = { BlogContentGenerator };
