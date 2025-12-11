const StudentManagement = {
    students: [],
    progressData: [],
    editingStudentId: null, // 수정 중인 학생 ID
    
    init() {
        this.bindEvents();
        this.loadStudents();
        this.loadProgress();
        
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
        
        // 모달 닫힐 때 폼 초기화
        $('#studentModal').on('hidden.bs.modal', () => {
            this.resetForm();
        });
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
            this.showAlert('학생 목록을 불러오는데 실패했습니다.', 'danger');
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
                    <td>${student.name || '-'}</td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.id}); return false;" 
                           style="color: #0d6efd; text-decoration: underline;">
                            ${student.userID}
                        </a>
                    </td>
                    <td>${student.email || '-'}</td>
                    <td>${student.created_at ? new Date(student.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                    <td>${student.last_access ? new Date(student.last_access).toLocaleDateString('ko-KR') : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" 
                                onclick="StudentManagement.editStudent(${student.id})" title="수정">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="StudentManagement.deleteStudent(${student.id}, '${student.name}')" title="삭제">
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
            const progressRate = student.progress_rate || 0;
            tbody.append(`
                <tr>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                            class="rounded-circle" width="40" height="40">
                    </td>
                    <td>${student.name || '-'}</td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.user_id}); return false;" 
                           style="color: #0d6efd; text-decoration: underline;">
                            ${student.username}
                        </a>
                    </td>
                    <td>${student.completed_contents || 0} / ${student.total_contents || 0}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${progressRate}%;">
                                ${progressRate}%
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
                            CT ${student.ct_level || 0}
                        </span>
                    </td>
                    <td>${student.last_learning_at || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="StudentManagement.openStudentDetail(${student.user_id})">
                            <i class="bi bi-eye"></i> 보기
                        </button>
                    </td>
                </tr>
            `);
        });
    },

    openStudentDetail(userId) {
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
        const searchLower = searchText.toLowerCase();
        const filtered = this.students.filter(s => 
            (s.name && s.name.toLowerCase().includes(searchLower)) || 
            (s.userID && s.userID.toLowerCase().includes(searchLower))
        );
        this.renderFilteredStudents(filtered);
    },
    
    renderFilteredStudents(filteredList) {
        const tbody = $('#studentTableBody');
        tbody.empty();
        
        if (filteredList.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        검색 결과가 없습니다.
                    </td>
                </tr>
            `);
            return;
        }
        
        filteredList.forEach(student => {
            tbody.append(`
                <tr>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                             class="rounded-circle" width="40" height="40">
                    </td>
                    <td>${student.name || '-'}</td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.id}); return false;" 
                           style="color: #0d6efd; text-decoration: underline;">
                            ${student.userID}
                        </a>
                    </td>
                    <td>${student.email || '-'}</td>
                    <td>${student.created_at ? new Date(student.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                    <td>${student.last_access ? new Date(student.last_access).toLocaleDateString('ko-KR') : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" 
                                onclick="StudentManagement.editStudent(${student.id})" title="수정">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="StudentManagement.deleteStudent(${student.id}, '${student.name}')" title="삭제">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    },
    
    filterProgress(searchText) {
        const searchLower = searchText.toLowerCase();
        const filtered = this.progressData.filter(s => 
            (s.name && s.name.toLowerCase().includes(searchLower)) || 
            (s.username && s.username.toLowerCase().includes(searchLower))
        );
        this.renderFilteredProgress(filtered);
    },
    
    renderFilteredProgress(filteredList) {
        const tbody = $('#progressTableBody');
        tbody.empty();
        
        if (filteredList.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        검색 결과가 없습니다.
                    </td>
                </tr>
            `);
            return;
        }
        
        filteredList.forEach(student => {
            const progressRate = student.progress_rate || 0;
            tbody.append(`
                <tr>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                            class="rounded-circle" width="40" height="40">
                    </td>
                    <td>${student.name || '-'}</td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.user_id}); return false;" 
                           style="color: #0d6efd; text-decoration: underline;">
                            ${student.username}
                        </a>
                    </td>
                    <td>${student.completed_contents || 0} / ${student.total_contents || 0}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${progressRate}%;">
                                ${progressRate}%
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
                            CT ${student.ct_level || 0}
                        </span>
                    </td>
                    <td>${student.last_learning_at || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="StudentManagement.openStudentDetail(${student.user_id})">
                            <i class="bi bi-eye"></i> 보기
                        </button>
                    </td>
                </tr>
            `);
        });
    },
    
    // ============================================
    // 학생 추가 모달 표시
    // ============================================
    showAddModal() {
        this.editingStudentId = null;
        $('#modalTitle').text('학생 추가');
        $('#studentForm')[0].reset();
        $('#studentId').val('');
        $('#userID').prop('disabled', false); // 아이디 입력 활성화
        $('#password').attr('placeholder', '비밀번호');
        $('#studentModal').modal('show');
    },
    
    // ============================================
    // 학생 수정 모달 표시
    // ============================================
    editStudent(id) {
        const student = this.students.find(s => s.id === id);
        if (!student) {
            this.showAlert('학생 정보를 찾을 수 없습니다.', 'danger');
            return;
        }
        
        this.editingStudentId = id;
        $('#modalTitle').text('학생 정보 수정');
        $('#studentId').val(id);
        $('#userID').val(student.userID).prop('disabled', true); // 아이디 수정 불가
        $('#name').val(student.name || '');
        $('#email').val(student.email || '');
        $('#password').val('').attr('placeholder', '변경 시에만 입력');
        $('#phone').val(student.phone || '');
        $('#birthdate').val(student.birthdate ? student.birthdate.split('T')[0] : '');
        
        $('#studentModal').modal('show');
    },
    
    // ============================================
    // 폼 초기화
    // ============================================
    resetForm() {
        this.editingStudentId = null;
        $('#studentForm')[0].reset();
        $('#studentId').val('');
        $('#userID').prop('disabled', false);
        $('#password').attr('placeholder', '비밀번호');
    },
    
    // ============================================
    // 학생 저장 (추가/수정)
    // ============================================
    async saveStudent() {
        const userID = $('#userID').val().trim();
        const name = $('#name').val().trim();
        const email = $('#email').val().trim();
        const password = $('#password').val();
        const phone = $('#phone').val().trim();
        const birthdate = $('#birthdate').val();
        
        // 필수 입력 검증
        if (!userID) {
            this.showAlert('아이디를 입력해주세요.', 'warning');
            $('#userID').focus();
            return;
        }
        
        if (!name) {
            this.showAlert('이름을 입력해주세요.', 'warning');
            $('#name').focus();
            return;
        }
        
        // 신규 추가 시 비밀번호 필수
        if (!this.editingStudentId && !password) {
            this.showAlert('비밀번호를 입력해주세요.', 'warning');
            $('#password').focus();
            return;
        }
        
        // 저장 버튼 비활성화 (중복 클릭 방지)
        const $saveBtn = $('#saveStudentBtn');
        const originalText = $saveBtn.text();
        $saveBtn.prop('disabled', true).text('저장 중...');
        
        try {
            let url, method, body;
            
            if (this.editingStudentId) {
                // 수정 모드
                url = `/teacher/api/students/${this.editingStudentId}`;
                method = 'PUT';
                body = { name, email, phone, birthdate };
                
                // 비밀번호가 입력된 경우에만 포함
                if (password) {
                    body.password = password;
                }
            } else {
                // 추가 모드
                url = '/teacher/api/students';
                method = 'POST';
                body = { userID, name, email, password, phone, birthdate };
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert(data.message || '저장되었습니다.', 'success');
                $('#studentModal').modal('hide');
                this.loadStudents(); // 목록 새로고침
                this.loadProgress(); // 진도 목록도 새로고침
            } else {
                this.showAlert(data.message || '저장에 실패했습니다.', 'danger');
            }
        } catch (error) {
            console.error('학생 저장 오류:', error);
            this.showAlert('저장 중 오류가 발생했습니다.', 'danger');
        } finally {
            // 버튼 복원
            $saveBtn.prop('disabled', false).text(originalText);
        }
    },
    
    // ============================================
    // 학생 삭제
    // ============================================
    async deleteStudent(id, name) {
        if (!confirm(`정말 "${name || '이 학생'}"을(를) 삭제하시겠습니까?\n\n삭제된 학생 정보는 복구할 수 없습니다.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/teacher/api/students/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert(data.message || '학생이 삭제되었습니다.', 'success');
                this.loadStudents(); // 목록 새로고침
                this.loadProgress(); // 진도 목록도 새로고침
            } else {
                this.showAlert(data.message || '삭제에 실패했습니다.', 'danger');
            }
        } catch (error) {
            console.error('학생 삭제 오류:', error);
            this.showAlert('삭제 중 오류가 발생했습니다.', 'danger');
        }
    },
    
    // ============================================
    // 알림 메시지 표시
    // ============================================
    showAlert(message, type = 'info') {
        // 기존 알림 제거
        $('.student-management-alert').remove();
        
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show student-management-alert" 
                 role="alert" style="position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        $('body').append(alertHtml);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            $('.student-management-alert').fadeOut(300, function() {
                $(this).remove();
            });
        }, 3000);
    }
};

window.StudentManagement = StudentManagement;
