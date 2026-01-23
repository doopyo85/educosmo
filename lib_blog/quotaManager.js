/**
 * Center Storage Quota Manager
 * 센터별 30GB 스토리지 관리
 */

const { queryDatabase } = require('../lib_login/db');
const { s3Client, BUCKET_NAME } = require('../lib_board/s3Utils');
const { ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');

class QuotaManager {
  constructor() {
    this.QUOTA_LIMIT_GB = 30; // 30GB per center
    this.QUOTA_LIMIT_BYTES = this.QUOTA_LIMIT_GB * 1024 * 1024 * 1024;
  }

  /**
   * 센터의 현재 스토리지 사용량 계산
   * @param {number} centerId - 센터 ID
   * @returns {Promise<{usedBytes: number, usedGB: number, remainingGB: number, percentage: number}>}
   */
  async getCenterStorageUsage(centerId) {
    try {
      // 1. blog_posts에서 멀티미디어 URL 수집
      const posts = await queryDatabase(
        `SELECT content, content_json, thumbnail_url
        FROM blog_posts
        WHERE blog_type = 'center'
        AND blog_id IN (SELECT id FROM center_blogs WHERE center_id = ?)`,
        [centerId]
      );

      // 2. S3 키 추출
      const s3Keys = new Set();

      posts.forEach(post => {
        // thumbnail_url
        if (post.thumbnail_url) {
          const key = this.extractS3Key(post.thumbnail_url);
          if (key) s3Keys.add(key);
        }

        // content HTML에서 이미지 추출
        if (post.content) {
          const imgMatches = post.content.matchAll(/<img[^>]+src="([^">]+)"/g);
          for (const match of imgMatches) {
            const key = this.extractS3Key(match[1]);
            if (key) s3Keys.add(key);
          }
        }

        // content_json에서 이미지 추출 (Tiptap format)
        if (post.content_json) {
          try {
            const json = JSON.parse(post.content_json);
            this.extractImagesFromJSON(json, s3Keys);
          } catch (e) {
            console.warn('JSON parse warning:', e);
          }
        }
      });

      // 3. 각 S3 객체의 크기 합산
      let totalBytes = 0;
      for (const key of s3Keys) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
          });
          const response = await s3Client.send(headCommand);
          totalBytes += response.ContentLength || 0;
        } catch (error) {
          console.warn(`Failed to get size for ${key}:`, error.message);
        }
      }

      const usedGB = totalBytes / (1024 * 1024 * 1024);
      const remainingGB = this.QUOTA_LIMIT_GB - usedGB;
      const percentage = (usedGB / this.QUOTA_LIMIT_GB) * 100;

      return {
        usedBytes: totalBytes,
        usedGB: parseFloat(usedGB.toFixed(2)),
        remainingGB: parseFloat(remainingGB.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(1)),
        limit: this.QUOTA_LIMIT_GB
      };

    } catch (error) {
      console.error('[QuotaManager] Storage usage calculation error:', error);
      throw error;
    }
  }

  /**
   * 스토리지 할당량 체크
   * @param {number} centerId - 센터 ID
   * @param {number} newFileSize - 추가할 파일 크기 (bytes)
   * @returns {Promise<{allowed: boolean, message: string}>}
   */
  async checkQuota(centerId, newFileSize = 0) {
    try {
      const usage = await this.getCenterStorageUsage(centerId);

      const afterUploadBytes = usage.usedBytes + newFileSize;
      const afterUploadGB = afterUploadBytes / (1024 * 1024 * 1024);

      if (afterUploadBytes > this.QUOTA_LIMIT_BYTES) {
        return {
          allowed: false,
          message: `스토리지 용량 초과: ${afterUploadGB.toFixed(2)}GB / ${this.QUOTA_LIMIT_GB}GB`,
          usage
        };
      }

      return {
        allowed: true,
        message: 'OK',
        usage
      };

    } catch (error) {
      console.error('[QuotaManager] Quota check error:', error);
      return {
        allowed: false,
        message: '스토리지 확인 실패',
        usage: null
      };
    }
  }

  /**
   * 센터별 스토리지 통계 조회
   * @param {number} centerId - 센터 ID
   * @returns {Promise<{usage: object, fileCount: number, largestFiles: Array}>}
   */
  async getCenterStorageStats(centerId) {
    try {
      const usage = await this.getCenterStorageUsage(centerId);

      // 파일 개수
      const [countResult] = await queryDatabase(
        `SELECT COUNT(*) as fileCount
        FROM blog_posts
        WHERE blog_type = 'center'
        AND blog_id IN (SELECT id FROM center_blogs WHERE center_id = ?)`,
        [centerId]
      );

      // 가장 큰 파일들 (예: 최근 업로드된 상위 10개)
      const largestFiles = await queryDatabase(
        `SELECT title, thumbnail_url, created_at
        FROM blog_posts
        WHERE blog_type = 'center'
        AND blog_id IN (SELECT id FROM center_blogs WHERE center_id = ?)
        ORDER BY created_at DESC
        LIMIT 10`,
        [centerId]
      );

      return {
        usage,
        fileCount: countResult.fileCount || 0,
        largestFiles
      };

    } catch (error) {
      console.error('[QuotaManager] Storage stats error:', error);
      throw error;
    }
  }

  /**
   * URL에서 S3 키 추출
   * @param {string} url - Full S3 URL
   * @returns {string|null} - S3 키
   */
  extractS3Key(url) {
    if (!url) return null;

    try {
      // S3 URL 패턴: https://kr.object.ncloudstorage.com/educodingnplaycontents/...
      const match = url.match(/educodingnplaycontents\/(.+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Tiptap JSON에서 이미지 추출
   * @param {object} json - Tiptap JSON
   * @param {Set} s3Keys - S3 키 Set
   */
  extractImagesFromJSON(json, s3Keys) {
    if (!json || typeof json !== 'object') return;

    // Tiptap 이미지 노드 찾기
    if (json.type === 'image' && json.attrs && json.attrs.src) {
      const key = this.extractS3Key(json.attrs.src);
      if (key) s3Keys.add(key);
    }

    // 재귀적으로 content 탐색
    if (json.content && Array.isArray(json.content)) {
      json.content.forEach(node => this.extractImagesFromJSON(node, s3Keys));
    }
  }

  /**
   * 바이트를 사람이 읽기 쉬운 형식으로 변환
   * @param {number} bytes - 바이트
   * @returns {string} - 포맷된 문자열
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 미사용 파일 정리 (수동 트리거)
   * blog_posts에서 참조되지 않는 S3 파일 찾기
   * @param {number} centerId - 센터 ID
   * @returns {Promise<{orphanedFiles: Array}>}
   */
  async findOrphanedFiles(centerId) {
    try {
      // 1. 센터의 모든 S3 키 수집
      const prefix = `blog/center-${centerId}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix
      });

      const listResult = await s3Client.send(listCommand);
      const allS3Keys = (listResult.Contents || []).map(obj => obj.Key);

      // 2. blog_posts에서 사용 중인 키 수집
      const posts = await queryDatabase(
        `SELECT content, content_json, thumbnail_url
        FROM blog_posts
        WHERE blog_type = 'center'
        AND blog_id IN (SELECT id FROM center_blogs WHERE center_id = ?)`,
        [centerId]
      );

      const usedKeys = new Set();
      posts.forEach(post => {
        if (post.thumbnail_url) {
          const key = this.extractS3Key(post.thumbnail_url);
          if (key) usedKeys.add(key);
        }

        if (post.content) {
          const imgMatches = post.content.matchAll(/<img[^>]+src="([^">]+)"/g);
          for (const match of imgMatches) {
            const key = this.extractS3Key(match[1]);
            if (key) usedKeys.add(key);
          }
        }

        if (post.content_json) {
          try {
            const json = JSON.parse(post.content_json);
            this.extractImagesFromJSON(json, usedKeys);
          } catch (e) {
            // Ignore
          }
        }
      });

      // 3. 미사용 파일 찾기
      const orphanedFiles = allS3Keys.filter(key => !usedKeys.has(key));

      return {
        orphanedFiles,
        count: orphanedFiles.length
      };

    } catch (error) {
      console.error('[QuotaManager] Find orphaned files error:', error);
      throw error;
    }
  }
}

module.exports = new QuotaManager();
