/**
 * 🎨 Entry Project Manager - ENT 파일 생성 및 관리
 */

const tar = require('tar');
const fs = require('fs').promises;
const path = require('path');
const s3Manager = require('./s3Manager');

class EntryProjectManager {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp/entry_projects');
    this.ensureTempDir();
  }

  /**
   * 임시 디렉토리 확인/생성
   */
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('임시 디렉토리 생성 실패:', error);
    }
  }

  /**
   * Entry 프로젝트를 ENT 파일로 생성
   * @param {Object} projectData - Entry.exportProject() 결과
   * @param {string} projectName - 프로젝트명
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Buffer>} ENT 파일 버퍼
   */
  async createEntFile(projectData, projectName, userId) {
    const timestamp = Date.now();
    const workDir = path.join(this.tempDir, `create_${timestamp}_${userId}`);
    
    try {
      // 1. 작업 디렉토리 생성
      await fs.mkdir(workDir, { recursive: true });
      await fs.mkdir(path.join(workDir, 'temp'), { recursive: true });
      
      console.log(`📁 ENT 파일 생성 시작: ${projectName}`);
      
      // 2. project.json 저장
      const projectJsonPath = path.join(workDir, 'temp', 'project.json');
      await fs.writeFile(
        projectJsonPath, 
        JSON.stringify(projectData, null, 2),
        'utf8'
      );
      
      // 3. 이미지 파일들 복사 (projectData의 objects에서 추출)
      await this.copyProjectAssets(projectData, workDir);
      
      // 4. TAR.GZ로 압축
      const entFileName = `${projectName}_${timestamp}.ent`;
      const entFilePath = path.join(workDir, entFileName);
      
      await tar.create(
        {
          gzip: true,
          file: entFilePath,
          cwd: workDir
        },
        ['temp']
      );
      
      console.log(`✅ ENT 파일 생성 완료: ${entFileName}`);
      
      // 5. ENT 파일 읽기
      const entBuffer = await fs.readFile(entFilePath);
      
      // 6. 임시 파일 정리
      await fs.rm(workDir, { recursive: true, force: true });
      
      return {
        fileName: entFileName,
        buffer: entBuffer,
        size: entBuffer.length
      };
      
    } catch (error) {
      console.error('❌ ENT 파일 생성 실패:', error);
      
      // 정리
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch (cleanError) {
        console.error('임시 파일 정리 실패:', cleanError);
      }
      
      throw new Error(`ENT 파일 생성 실패: ${error.message}`);
    }
  }

  /**
   * 프로젝트 에셋 복사 (이미지, 사운드 등)
   * @param {Object} projectData - Entry 프로젝트 데이터
   * @param {string} workDir - 작업 디렉토리
   */
  async copyProjectAssets(projectData, workDir) {
    try {
      // Entry 프로젝트 구조에서 이미지 경로 추출
      const objects = projectData.objects || [];
      
      for (const obj of objects) {
        const pictures = obj.pictures || [];
        const sounds = obj.sounds || [];
        
        // 이미지 처리
        for (const picture of pictures) {
          if (picture.filename) {
            await this.copyAssetFile(picture.filename, workDir, 'image');
          }
        }
        
        // 사운드 처리
        for (const sound of sounds) {
          if (sound.filename) {
            await this.copyAssetFile(sound.filename, workDir, 'sound');
          }
        }
      }
      
      console.log('✅ 프로젝트 에셋 복사 완료');
      
    } catch (error) {
      console.error('⚠️ 에셋 복사 중 일부 오류:', error.message);
      // 에셋 복사 실패는 치명적이지 않으므로 계속 진행
    }
  }

  /**
   * 개별 에셋 파일 복사
   */
  async copyAssetFile(filename, workDir, type) {
    try {
      // Entry 에셋 경로 파싱 (예: 60/62/image/6062p3x0...png)
      const parts = filename.split('/');
      if (parts.length < 3) return;
      
      const assetPath = path.join(workDir, 'temp', ...parts.slice(0, -1));
      await fs.mkdir(assetPath, { recursive: true });
      
      // 원본 파일 경로 (current 디렉토리에서 찾기)
      const sourcePath = path.join(__dirname, '../temp/ent_files/current', filename);
      const destPath = path.join(workDir, 'temp', filename);
      
      // 파일이 존재하면 복사
      try {
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, destPath);
      } catch {
        // 파일이 없으면 건너뛰기
        console.log(`⚠️ 에셋 파일 없음: ${filename}`);
      }
      
    } catch (error) {
      console.error(`에셋 복사 실패 (${filename}):`, error.message);
    }
  }

  /**
   * 🔥 프로젝트 저장 (S3 + DB) - saveType 지원 (draft/final)
   * @param {string} userId - 사용자 ID
   * @param {string} projectName - 프로젝트명
   * @param {Object} projectData - Entry 프로젝트 데이터
   * @param {string} saveType - 'draft' or 'final'
   * @returns {Promise<Object>} 저장 결과
   */
  async saveProject(userId, projectName, projectData, saveType = 'draft') {
    try {
      console.log(`💾 Entry 프로젝트 저장 시작: ${projectName} (${saveType})`);
      
      // 1. ENT 파일 생성
      const { fileName, buffer, size } = await this.createEntFile(
        projectData,
        projectName,
        userId
      );
      
      // 2. 🔥 S3 업로드 (saveType에 따라 경로 결정)
      const targetPath = saveType === 'final' 
        ? `users/${userId}/entry/final/`
        : `users/${userId}/entry/draft/`;
      
      console.log(`📌 Entry 저장 경로 (${saveType}): ${targetPath}${fileName}`);
      
      const s3Result = await s3Manager.uploadUserProject(
        userId,
        null,              // platform은 사용하지 않음
        fileName,
        buffer,
        targetPath         // Entry 전용 경로 지정
      );
      
      // 3. 메타데이터 생성
      const metadata = {
        projectName: projectName,
        fileName: fileName,
        s3Key: s3Result.s3Key,
        s3Url: s3Result.s3Url,
        fileSize: size,
        saveType: saveType,
        objects: projectData.objects?.length || 0,
        scenes: projectData.scenes?.length || 0,
        variables: projectData.variables?.length || 0,
        savedAt: new Date().toISOString()
      };
      
      // 4. 🔥 메타데이터는 .meta.json으로 저장 (숨김 처리용)
      const metadataFileName = fileName.replace('.ent', '.meta.json');
      await s3Manager.uploadUserProject(
        userId,
        null,
        metadataFileName,
        Buffer.from(JSON.stringify(metadata, null, 2)),
        targetPath         // 같은 경로에 메타데이터 저장
      );
      
      console.log(`✅ Entry 프로젝트 저장 완료: ${s3Result.s3Key}`);
      
      return {
        success: true,
        ...metadata
      };
      
    } catch (error) {
      console.error('❌ Entry 프로젝트 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로젝트 목록 조회
   */
  async listUserProjects(userId, saveType = 'draft') {
    try {
      const projects = await s3Manager.listUserProjects(userId, 'entry', saveType);
      
      // .ent 파일만 필터링
      return projects.filter(p => p.fileName.endsWith('.ent'));
      
    } catch (error) {
      console.error('프로젝트 목록 조회 실패:', error);
      return [];
    }
  }
}

module.exports = new EntryProjectManager();
