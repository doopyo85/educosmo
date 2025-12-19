
$docsPath = "C:\Users\User\Documents\pioneer\educodingnplay\docs"
cd $docsPath

# Helper function to rename securely
function Safe-Rename {
    param ($Old, $NewPrefix, $NewName)
    if (-not $NewName) { $NewName = $Old }
    
    # Remove existing prefix if present to avoid "entryjs entryjs ..."
    if ($NewName.StartsWith($NewPrefix)) {
        # Already has prefix, make sure there's a space if needed, or leave it
        # Actually, user wants "entryjs ", so if it's "entryjs...txt" (no space), implies insertion
        # But if it is "entryjs ...", leave it.
    }
    
    # Clean up filename (remove existing category prefixes if we are re-applying)
    # This is tricky without regex. Let's just prepend if not present.
    
    $FinalName = "$NewPrefix$NewName"
    
    # Special case: if name already starts with prefix (case insensitive)
    if ($NewName -match "^$NewPrefix") {
        $FinalName = $NewName
    }
    
    # Handle the specific "ide..." no space case
    if ($NewPrefix -eq "ide " -and $NewName -match "^ide[^ ]") {
       # e.g. ideComponent -> ide Component
       $Suffix = $NewName.Substring(3)
       $FinalName = "ide $Suffix"
    }
     # Handle the specific "entryjs..." no space case
    if ($NewPrefix -eq "entryjs " -and $NewName -match "^entryjs[^ ]") {
       $Suffix = $NewName.Substring(7)
       $FinalName = "entryjs $Suffix"
    }

    if (-not (Test-Path $FinalName)) {
        echo "Renaming '$Old' to '$FinalName'"
        Rename-Item -LiteralPath $Old -NewName $FinalName
    } else {
        echo "Skipping '$Old', target '$FinalName' exists."
    }
}

# 1. EntryJS Related
Safe-Rename "Entry_저장소_통합작업_설계서.md" "entryjs "
Safe-Rename "entry-tool_메서드명세서.txt" "entryjs "
Safe-Rename "entry_내가만든통합초기화모듈.txt" "entryjs "
Safe-Rename "entryjs S3 프로젝트파일 연동 명세서.txt" "entryjs " "S3 프로젝트파일 연동 명세서.txt"
Safe-Rename "entryjs TTS webspeech 기능추가.txt" "entryjs " "TTS webspeech 기능추가.txt"
Safe-Rename "entryjs 오브젝트 에셋추가와 이미지 표시.txt" "entryjs " "오브젝트 에셋추가와 이미지 표시.txt"
Safe-Rename "entryjs 오브젝트 이미지업로드 기능추가 명세서.txt" "entryjs " "오브젝트 이미지업로드 기능추가 명세서.txt"
Safe-Rename "entryjs 오브젝트 이미지호출 명세서.txt" "entryjs " "오브젝트 이미지호출 명세서.txt"
Safe-Rename "entryjs 인공지능블록.txt" "entryjs " "인공지능블록.txt"
Safe-Rename "entryjs 저장불러오기_통합시스템_명세서.md" "entryjs " "저장불러오기_통합시스템_명세서.md"
Safe-Rename "entryjs 타입정의+ent파일관리.txt" "entryjs " "타입정의+ent파일관리.txt"
Safe-Rename "entryjs저장기능추가.txt" "entryjs " "저장기능추가.txt"
Safe-Rename "entryjs팝업관리.txt" "entryjs " "팝업관리.txt"
Safe-Rename "entryjs핵심api.txt" "entryjs " "핵심api.txt"
Safe-Rename "entry설치방법.txt" "entryjs " "entry설치방법.txt"
Safe-Rename "entryjs Base 8070 독립서버명세서.txt" "entryjs " "Base 8070 독립서버명세서.txt"


# 2. IDE Related (Jupyter, Scratch, IDE components)
Safe-Rename "ide컴포넌트정의명세서.txt" "ide " "컴포넌트정의명세서.txt"
Safe-Rename "ide코드에디터기능정의명세.txt" "ide " "코드에디터기능정의명세.txt"
Safe-Rename "ide해설기능정의명세서.txt" "ide " "해설기능정의명세서.txt"
Safe-Rename "Jupyter_lab_ecosystem.txt" "ide "
Safe-Rename "Jupyter_notebook_ecosystem.txt" "ide "
Safe-Rename "jupyter_userFile격리시스템.txt" "ide "
Safe-Rename "jupyter컴포넌트 명세서.txt" "ide "
Safe-Rename "scratch 8601스크래치연동.txt" "ide "
Safe-Rename "odeFilter.txt" "ide " "AppInventor_odeFilter.txt"

# 3. Board Related (Admin, Quiz, LMS)
Safe-Rename "board 게시판기능정의명세서.txt" "board " "게시판기능정의명세서.txt"
Safe-Rename "썸네일이미지_표준사양.txt" "board "
Safe-Rename "퀴즈_icon_test.html" "board "
Safe-Rename "퀴즈_답안타입정의명세서.txt" "board "
# LMS Files (Group under board as requested contextually)
Safe-Rename "학습관리) 8070 엔트리 헤더 구현 및 s3저장불러오기 기능구현.txt" "board " "학습관리_엔트리헤더_S3저장.txt"
Safe-Rename "학습관리) CT기반학습관리시스템구축프로젝트명세서.txt" "board " "학습관리_CT시스템구축.txt"
Safe-Rename "학습관리) S3탐색기모듈.txt" "board " "학습관리_S3탐색기.txt"
Safe-Rename "학습관리) 통합프로젝트저장시스템아키텍처설계.txt" "board " "학습관리_통합저장시스템.txt"
Safe-Rename "학습관리) 프로젝트 자동저장 및 제출시스템 구현계획.txt" "board " "학습관리_자동저장_제출.txt"

# 4. Policy Related
Safe-Rename "Docker_Adoption_Policy.md" "policy "
Safe-Rename "Judge0_Integration_Policy.md" "policy "
Safe-Rename "css_policy_v1.0.md" "policy "
Safe-Rename "계정권한정책.txt" "policy "
Safe-Rename "문항번호 네이밍규칙.txt" "policy "
Safe-Rename "플랫폼_통합저장소_정책명세서.md" "policy "
Safe-Rename "user-session-isolation-update.md" "policy "
Safe-Rename "user-session-isolation-update.md.backup" "policy "

# 5. Project/Common Structure (Prefix: project)
Safe-Rename "##educodingnplay_프로젝트전체구조명세서.txt" "project " "프로젝트전체구조명세서.txt"
Safe-Rename "DB 테이블명세서.txt" "project "
Safe-Rename "S3_스토리지_API_명세서.txt" "project "
Safe-Rename "educodingnplay컴포넌트시스템아키텍처명세서.txt" "project "
Safe-Rename "project_blueprint_galaxy.md" "project "
Safe-Rename "폴더구조 & 네트워크 세팅.txt" "project "
Safe-Rename "프로젝트summary.txt" "project "

