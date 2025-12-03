const StudentManagement = {
    students: [],
    progressData: [],
    
    init() {
        this.bindEvents();
        this.loadStudents();
        this.loadProgress(); // 🔥 초기 로드 시 진도 데이터도 가져오기
        
        // 탭 전환 이벤트
        $('#progress-tab').on('shown.bs.tab', () => {
            if (this.progressData.length === 0) {
                this.loadProgress();
            }
        });
        
        $('#list-tab').on('shown.bs.tab', () => {
            if (this.students.length === 0) {
                this.loadStudents();
            }
        });
    },
    
    bindEvents() {
        // 학생 검색
        $('#studentSearch').on('input', (e) => {
            this.filterStudents(e.target.value);
        });
        
        // 진도 검색
        $('#progressSearch').on('input', (e) => {
            this.filterProgress(e.target.value);
        });
        
        // 학생 추가 버튼
        $('#addStudentBtn').on('click', () => this.showAddModal());
        
        // 학생 저장 버튼
        $('#saveStudentBtn').on('click', () => this.saveStudent());
    },
    
    async loadStudents() {
        try {
            const response = await fetch('/teacher/api/students');
            const data = await response.json();
            
            if (data.success) {
                this.students = data.students;
                this.renderStudents();
            }
        } catch (error) {
            console.error('학생 목록 로드 오류:', error);
        }
    },
    
    async loadProgress() {
        try {
            const response = await fetch('/teacher/api/student-progress');
            const data = await response.json();
            
            if (data.success) {
                this.progressData = data.students;
                this.renderProgress();
            } else {
                console.error('진도 데이터 로드 실패:', data.message);
            }
        } catch (error) {
            console.error('진도 데이터 로드 오류:', error);
        }
    },
    
    renderStudents() {
        const tbody = $('#studentTableBody');
        tbody.empty();
        
        if (this.students.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        등록된 학생이 없습니다.
                    </td>
                </tr>
            `);
            return;
        }
        
        this.students.forEach(student => {
            tbody.append(`
                <tr>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                             class="rounded-circle" width="40" height="40">
                    </td>
                    <td>${student.name}</td>
                    <td><a href="#" onclick="StudentManagement.openStudentDetail(${student.id}); return false;" style="color: #0d6efd; text-decoration: underline;">${student.userID}</a></td>
                    <td>${student.email || '-'}</td>
                    <td>${new Date(student.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>${student.last_access ? new Date(student.last_access).toLocaleDateString('ko-KR') : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="StudentManagement.editStudent(${student.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="StudentManagement.deleteStudent(${student.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    },
    
    renderProgress() {
        const tbody = $('#progressTableBody');
        tbody.empty();
        
        if (this.progressData.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        학습 진도 데이터가 없습니다.
                    </td>
                </tr>
            `);
            return;
        }
        
        this.progressData.forEach(student => {
            tbody.append(`
                <tr>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                            class="rounded-circle" width="40" height="40">
                    </td>
                    <td>${student.name}</td>
                    <td><a href="#" onclick="StudentManagement.openStudentDetail(${student.user_id}); return false;" style="color: #0d6efd; text-decoration: underline;">${student.username}</a></td>
                    <td>${student.completed_contents} / ${student.total_contents}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${student.progress_rate}%;">
                                ${student.progress_rate}%
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-info text-dark">
                            ${student.current_platform || '-'}
                        </span>
                    </td>
                    <td>
                        <span class="badge bg-success">
                            CT ${student.ct_level || '0'}
                        </span>
                    </td>
                    <td>${student.last_learning_at || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="StudentManagement.openStudentDetail(${student.user_id})">
                            <i class="bi bi-eye"></i> 보기
                        </button>
                    </td>
                </tr>
            `);
        });
    },

    openStudentDetail(userId) {
        // 팝업 창으로 열기
        const width = 900;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
            `/teacher/student-detail/${userId}`,
            'studentDetail',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
    },

   
    
    filterStudents(searchText) {
        const filtered = this.students.filter(s => 
            s.name.includes(searchText) || s.userID.includes(searchText)
        );
        // 필터링 후 렌더링 로직 추가 필요
    },
    
    filterProgress(searchText) {
        const filtered = this.progressData.filter(s => 
            s.name.includes(searchText) || s.username.includes(searchText)
        );
        // 필터링 후 렌더링 로직 추가 필요
    },
    
    showAddModal() {
        $('#modalTitle').text('학생 추가');
        $('#studentForm')[0].reset();
        $('#studentId').val('');
        $('#studentModal').modal('show');
    },
    
    editStudent(id) {
        // 구현 필요
    },
    
    deleteStudent(id) {
        if (confirm('정말 이 학생을 삭제하시겠습니까?')) {
            // 삭제 API 호출
        }
    },
    
    async saveStudent() {
        // 구현 필요
    }
};

window.StudentManagement = StudentManagement;