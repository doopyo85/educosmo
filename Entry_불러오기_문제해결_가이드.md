# 🚨 Entry 프로젝트 불러오기 문제 해결 가이드

**발생일**: 2025년 11월 21일  
**증상**: 불러오기 성공 메시지는 뜨지만 Entry 워크스페이스에 프로젝트가 로드되지 않음

---

## 🔍 문제 증상

### 1. 브라우저 콘솔 오류
```
❌ /temp/4c/f0/image/4cf01589lt5b48o23639a2c943cdfwg0.png: 404
❌ /temp/24/4c/image/244cf015lt5b48o23639a2c943cddo6q.png: 404
... (대량의 이미지 404 오류)
```

### 2. 서버 로그
```
✅ S3 ENT 파일 로드 성공! { fileName: 'cpe1-3a.ent', fileSize: '452.7 KB', objects: 6, scenes: 1 }
✅ 오브젝트 이미지 경로를 8070번 서버용으로 수정 완료
```

### 3. 클라이언트
```javascript
✅ 프로젝트 불러오기 성공! 프로젝트명: cpe1-3a
// 하지만 Entry 워크스페이스는 비어있음
```

---

## 🎯 문제 원인

### 원인 1: Entry.loadProject() 오류 미처리
**현재 코드:**
```javascript
Entry.loadProject(result.projectData);
// 오류 발생 시 try-catch로 잡히지만 상세 로그 없음
```

**문제점:**
- Entry.loadProject() 내부에서 오류 발생 시 무시됨
- 이미지 로드 실패로 인한 렌더링 실패 가능성

---

### 원인 2: 이미지 경로 불일치

**Entry가 요청하는 경로:**
```
/temp/4c/f0/image/4cf01589lt5b48o23639a2c943cdfwg0.png
```

**실제 서버 저장 경로:**
```
/var/www/html/temp/ent_files/users/forena_COu2xvHeoyV0e4iUXTJgFGYnD93pKDNW/temp/...
```

**Apache는 `/temp/` 요청을 어디로 보내야 할지 모름!**

---

## ✅ 해결 방법

### 수정 1: projectSaver.js - Entry.loadProject 강화

**파일**: `entry/js/projectSaver.js`

**수정 전:**
```javascript
Entry.loadProject(result.projectData);

// 파일명에서 프로젝트명 추출
const extractedName = this.extractProjectNameFromFile(projectName);
this.setProjectName(extractedName);
```

**수정 후:**
```javascript
// 🔥 Entry.loadProject 호출 전 로그
console.log('🚀 Entry.loadProject() 호출 중...', {
  objectsCount: result.projectData.objects?.length || 0,
  scenesCount: result.projectData.scenes?.length || 0,
  variablesCount: result.projectData.variables?.length || 0
});

// 🔥 try-catch로 Entry.loadProject 래핑
try {
  Entry.loadProject(result.projectData);
  console.log('✅ Entry.loadProject() 성공!');
} catch (entryError) {
  console.error('❌ Entry.loadProject() 실패:', entryError);
  throw new Error(`Entry 워크스페이스 로드 실패: ${entryError.message}`);
}

// 파일명에서 프로젝트명 추출
const extractedName = this.extractProjectNameFromFile(projectName);
this.setProjectName(extractedName);
```

---

### 수정 2: Apache 프록시 설정 - /temp/ 경로 추가

**파일**: `/etc/apache2/sites-available/000-default.conf` (서버)

**추가할 설정:**
```apache
# 🔥 Entry 임시 이미지 서빙 (사용자별 격리)
Alias /temp /var/www/html/temp/ent_files/current/temp
<Directory "/var/www/html/temp/ent_files/current/temp">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    Header always set Access-Control-Allow-Origin "*"
    Header always set Cache-Control "public, max-age=3600"
</Directory>
```

**설명:**
- `/temp/` 요청을 `current/temp/`로 리다이렉트
- `current`는 심볼릭 링크 (사용자별 세션 폴더를 가리킴)
- 예: `current -> /var/www/html/temp/ent_files/users/forena_session123/`

---

### 수정 3: 심볼릭 링크 유지 확인

**서버 로그 확인:**
```
current 심볼릭 링크 업데이트: /var/www/html/temp/ent_files/current -> /var/www/html/temp/ent_files/users/forena_COu2xvHeoyV0e4iUXTJgFGYnD93pKDNW
```

✅ 이미 서버에서 처리 중

---

## 🚀 적용 순서

### 1️⃣ 로컬에서 projectSaver.js 수정

**Windows PowerShell:**
```powershell
# 파일 열기
code "C:\Users\admin\OneDrive\문서\pioneer\educodingnplay\entry\js\projectSaver.js"
```

**수정할 부분 (약 530번째 줄):**
```javascript
// 🔥 Entry.loadProject 호출 전 로그 추가
console.log('🚀 Entry.loadProject() 호출 중...', {
  objectsCount: result.projectData.objects?.length || 0,
  scenesCount: result.projectData.scenes?.length || 0
});

// 🔥 try-catch 추가
try {
  Entry.loadProject(result.projectData);
  console.log('✅ Entry.loadProject() 성공!');
} catch (entryError) {
  console.error('❌ Entry.loadProject() 실패:', entryError);
  throw new Error(`Entry 워크스페이스 로드 실패: ${entryError.message}`);
}
```

---

### 2️⃣ Git으로 서버 반영

```powershell
cd "C:\Users\admin\OneDrive\문서\pioneer\educodingnplay"

git add entry/js/projectSaver.js
git commit -m "fix: Entry.loadProject 오류 처리 강화

- try-catch로 Entry.loadProject 래핑
- 상세 로그 추가
- 오류 발생 시 명확한 메시지 표시"

git push origin main
```

---

### 3️⃣ 서버에서 Apache 설정 추가

**SSH 접속:**
```bash
ssh ubuntu@your-server
```

**Apache 설정 파일 편집:**
```bash
sudo vi /etc/apache2/sites-available/000-default.conf
```

**추가할 내용 (기존 <VirtualHost> 내부에):**
```apache
# 🔥 Entry 임시 이미지 서빙
Alias /temp /var/www/html/temp/ent_files/current/temp
<Directory "/var/www/html/temp/ent_files/current/temp">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    Header always set Access-Control-Allow-Origin "*"
    Header always set Cache-Control "public, max-age=3600"
</Directory>
```

**Apache 재시작:**
```bash
sudo systemctl restart apache2
```

---

### 4️⃣ Git Pull 및 PM2 재시작

```bash
cd /var/www/html
git pull origin main
pm2 restart server
```

---

### 5️⃣ 테스트

**브라우저에서:**
1. Entry 에디터 열기
2. "불러오기" 버튼 클릭
3. 프로젝트 선택
4. **F12 콘솔** 확인

**예상 로그:**
```
📂 프로젝트 불러오기 시작: ID 123, Name: my_game
📦 프로젝트 데이터 수신: { hasData: true, dataType: 'object', keys: [...] }
🚀 Entry.loadProject() 호출 중... { objectsCount: 6, scenesCount: 1 }
✅ Entry.loadProject() 성공!
✅ 프로젝트 불러오기 성공! 프로젝트명: my_game
```

**이미지 로드 확인:**
```
✅ /temp/4c/f0/image/4cf01589lt5b48o23639a2c943cdfwg0.png: 200 OK
```

---

## 🔍 추가 디버깅

### Entry.loadProject()가 실패하는 경우

**브라우저 콘솔에서 직접 테스트:**
```javascript
// 프로젝트 데이터 확인
console.log('프로젝트 데이터:', result.projectData);

// Entry.loadProject 직접 호출
try {
  Entry.loadProject(result.projectData);
  console.log('✅ 성공');
} catch (e) {
  console.error('❌ 실패:', e);
}
```

---

### 이미지 경로가 여전히 404인 경우

**서버에서 심볼릭 링크 확인:**
```bash
ls -la /var/www/html/temp/ent_files/current
# 출력 예:
# lrwxrwxrwx 1 ubuntu ubuntu 56 Nov 21 02:16 /var/www/html/temp/ent_files/current -> /var/www/html/temp/ent_files/users/forena_session123
```

**이미지 파일 존재 확인:**
```bash
ls -la /var/www/html/temp/ent_files/current/temp/4c/f0/image/
```

---

## 📝 체크리스트

### 서버 설정
- [ ] Apache 설정에 `/temp/` Alias 추가
- [ ] Apache 재시작
- [ ] 심볼릭 링크 `current` 존재 확인
- [ ] 이미지 파일들 압축 해제 확인

### 클라이언트 코드
- [ ] projectSaver.js에 try-catch 추가
- [ ] 상세 로그 추가
- [ ] Git push 완료

### 테스트
- [ ] 불러오기 성공
- [ ] 콘솔에서 "Entry.loadProject() 성공!" 확인
- [ ] 이미지 404 오류 없음
- [ ] Entry 워크스페이스에 프로젝트 표시됨

---

## 🎉 성공 시 예상 결과

1. ✅ 불러오기 버튼 클릭
2. ✅ 모달에서 프로젝트 선택
3. ✅ 콘솔: "Entry.loadProject() 성공!"
4. ✅ 이미지들이 정상 로드 (200 OK)
5. ✅ Entry 워크스페이스에 프로젝트 표시
6. ✅ 오브젝트들이 화면에 렌더링

---

**🔗 관련 파일:**
- `entry/js/projectSaver.js` (클라이언트)
- `/etc/apache2/sites-available/000-default.conf` (서버)
- `lib_entry/entFileManager.js` (서버 - 이미지 경로 수정)

---

**📅 작성일**: 2025년 11월 21일  
**🔄 상태**: 진행 중
