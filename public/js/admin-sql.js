let currentTable = null;
let currentPage = 1;

// 테이블 선택
document.querySelectorAll('[data-table]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    currentTable = e.target.dataset.table;
    currentPage = 1;
    
    document.getElementById('currentTable').textContent = currentTable;
    
    // 활성 표시
    document.querySelectorAll('[data-table]').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    await loadTableData();
    await loadTableStructure();
  });
});

// 테이블 구조 로드
async function loadTableStructure() {
  const response = await fetch(`/admin/api/table-structure/${currentTable}`);
  const { structure } = await response.json();
  
  const structureDiv = document.getElementById('tableStructure');
  const table = document.getElementById('structureTable');
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>필드명</th>
        <th>타입</th>
        <th>Null</th>
        <th>Key</th>
        <th>Default</th>
      </tr>
    </thead>
    <tbody>
      ${structure.map(col => `
        <tr>
          <td>${col.Field}</td>
          <td>${col.Type}</td>
          <td>${col.Null}</td>
          <td>${col.Key}</td>
          <td>${col.Default || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  
  structureDiv.style.display = 'block';
}

// 테이블 데이터 로드
async function loadTableData(page = 1) {
  const response = await fetch(`/admin/api/table-data/${currentTable}?page=${page}&limit=50`);
  const { data, total, totalPages } = await response.json();
  
  if (data.length === 0) {
    document.querySelector('#dataTable tbody').innerHTML = 
      '<tr><td colspan="100" class="text-center">데이터가 없습니다</td></tr>';
    return;
  }
  
  // 테이블 헤더
  const columns = Object.keys(data[0]);
  const thead = document.querySelector('#dataTable thead');
  thead.innerHTML = `
    <tr>
      ${columns.map(col => `<th>${col}</th>`).join('')}
      <th>액션</th>
    </tr>
  `;
  
  // 테이블 바디
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = data.map((row, idx) => `
    <tr data-id="${row[columns[0]]}">
      ${columns.map(col => `
        <td class="editable-cell" data-field="${col}">${row[col] ?? ''}</td>
      `).join('')}
      <td>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${row[columns[0]]}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
  
  // 페이지네이션
  renderPagination(totalPages, page);
  
  // 이벤트 리스너
  attachEventListeners();
}

// 페이지네이션 렌더링
function renderPagination(totalPages, currentPage) {
  const pagination = document.querySelector('#pagination ul');
  pagination.innerHTML = '';
  
  for (let i = 1; i <= totalPages; i++) {
    pagination.innerHTML += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }
  
  document.getElementById('pagination').style.display = 'block';
  
  // 페이지 클릭 이벤트
  document.querySelectorAll('.page-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = parseInt(e.target.dataset.page);
      await loadTableData(page);
    });
  });
}

// 이벤트 리스너 부착
function attachEventListeners() {
  // 셀 편집
  document.querySelectorAll('.editable-cell').forEach(cell => {
    cell.addEventListener('dblclick', async (e) => {
      const field = e.target.dataset.field;
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const oldValue = e.target.textContent;
      
      const newValue = prompt(`${field} 수정:`, oldValue);
      if (newValue !== null && newValue !== oldValue) {
        const response = await fetch(`/admin/api/table-data/${currentTable}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: newValue })
        });
        
        const result = await response.json();
        if (result.success) {
          e.target.textContent = newValue;
          alert('수정 완료');
        } else {
          alert('수정 실패: ' + result.error);
        }
      }
    });
  });
  
  // 삭제 버튼
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('button').dataset.id;
      
      if (!confirm('정말 삭제하시겠습니까?')) return;
      
      const response = await fetch(`/admin/api/table-data/${currentTable}/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        alert('삭제 완료');
        await loadTableData(currentPage);
      } else {
        alert('삭제 실패: ' + result.error);
      }
    });
  });
}

// CSV 업로드
document.getElementById('uploadCsvBtn').addEventListener('click', async () => {
  if (!currentTable) {
    alert('테이블을 먼저 선택하세요');
    return;
  }
  
  const fileInput = document.getElementById('csvFile');
  if (!fileInput.files[0]) {
    alert('파일을 선택하세요');
    return;
  }
  
  const formData = new FormData();
  formData.append('csvFile', fileInput.files[0]);
  
  const response = await fetch(`/admin/api/upload-csv/${currentTable}`, {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  if (result.success) {
    alert(result.message);
    bootstrap.Modal.getInstance(document.getElementById('csvUploadModal')).hide();
    await loadTableData();
  } else {
    alert('업로드 실패: ' + result.error);
  }
});

// SQL 실행
document.getElementById('executeSqlBtn').addEventListener('click', async () => {
  const sql = document.getElementById('sqlEditor').value.trim();
  
  if (!sql) {
    alert('SQL을 입력하세요');
    return;
  }
  
  const response = await fetch('/admin/api/execute-sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  
  const result = await response.json();
  const resultDiv = document.getElementById('sqlResult');
  
  if (result.success) {
    resultDiv.innerHTML = `
      <div class="alert alert-success">
        <strong>실행 완료</strong>
        <pre>${JSON.stringify(result.result, null, 2)}</pre>
      </div>
    `;
  } else {
    resultDiv.innerHTML = `
      <div class="alert alert-danger">
        <strong>오류</strong>: ${result.error}
      </div>
    `;
  }
});

// 새로고침
document.getElementById('refreshBtn').addEventListener('click', () => {
  if (currentTable) loadTableData(currentPage);
});