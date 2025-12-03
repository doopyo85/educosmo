// 
// iframe-style-injector.js에 추가하거나 별도 파일로 사용 가능

// Python 코드 구문 강조 함수
function highlightPythonSyntax(codeElement) {
    if (!codeElement || !codeElement.textContent) return;
    
    // 코드 텍스트 가져오기
    var code = codeElement.textContent;
    
    // Python 키워드 목록
    var keywords = [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 
        'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 
        'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 
        'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 
        'while', 'with', 'yield'
    ];
    
    // 내장 함수/메서드 목록
    var builtins = [
        'abs', 'all', 'any', 'bin', 'bool', 'bytes', 'chr', 'dict', 'dir',
        'enumerate', 'eval', 'exec', 'filter', 'float', 'format', 'frozenset',
        'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input',
        'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals',
        'map', 'max', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow',
        'print', 'property', 'range', 'repr', 'reversed', 'round', 'set',
        'setattr', 'slice', 'sorted', 'str', 'sum', 'super', 'tuple', 'type',
        'vars', 'zip'
    ];
    
    // 코드를 라인별로 처리
    var lines = code.split('\n');
    var highlightedCode = '';
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var tokens = [];
        var currentPosition = 0;
        
        // 코멘트 처리 (# 이후)
        var commentStart = line.indexOf('#');
        if (commentStart !== -1) {
            var beforeComment = line.substring(0, commentStart);
            var comment = line.substring(commentStart);
            
            // 코멘트 이전 부분 처리
            tokens.push(tokenizeLine(beforeComment));
            
            // 코멘트 부분 처리
            tokens.push(`<span class="comment">${escapeHTML(comment)}</span>`);
        } else {
            tokens.push(tokenizeLine(line));
        }
        
        highlightedCode += tokens.join('') + '\n';
    }
    
    // 라인 내 토큰화 처리
    function tokenizeLine(line) {
        // 정규표현식으로 각 요소 처리
        
        // 문자열 처리 (따옴표로 둘러싸인 부분)
        line = line.replace(/(["'])(.*?)\1/g, '<span class="string">$&</span>');
        
        // 숫자 처리
        line = line.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
        
        // 키워드 처리
        for (var j = 0; j < keywords.length; j++) {
            var keyword = keywords[j];
            var keywordRegex = new RegExp('\\b' + keyword + '\\b', 'g');
            line = line.replace(keywordRegex, '<span class="keyword">$&</span>');
        }
        
        // 내장 함수 처리
        for (var j = 0; j < builtins.length; j++) {
            var builtin = builtins[j];
            var builtinRegex = new RegExp('\\b' + builtin + '\\b', 'g');
            line = line.replace(builtinRegex, '<span class="builtin">$&</span>');
        }
        
        // 연산자 처리
        line = line.replace(/([+\-*/%=<>!&|^~.])+/g, '<span class="operator">$&</span>');
        
        return line;
    }
    
    // HTML 문자 이스케이프
    function escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // 처리된 코드를 HTML로 설정
    codeElement.innerHTML = highlightedCode;
}

// iframe 로드 후 코드 블록에 구문 강조 적용
function applyPythonSyntaxHighlighting(iframeDoc) {
    // Python 코드 블록 찾기
    var codeBlocks = iframeDoc.querySelectorAll('pre.python code, pre code.python');
    
    // 각 코드 블록에 구문 강조 적용
    for (var i = 0; i < codeBlocks.length; i++) {
        highlightPythonSyntax(codeBlocks[i]);
    }
    
    // Python 코드로 판단되는 모든 코드 블록에도 적용
    var allCodeBlocks = iframeDoc.querySelectorAll('pre code');
    for (var i = 0; i < allCodeBlocks.length; i++) {
        var codeText = allCodeBlocks[i].textContent;
        // Python 코드로 추정되는 패턴 확인
        if (/\b(def|class|import|from|print|if|else|for|while|return)\b/.test(codeText)) {
            highlightPythonSyntax(allCodeBlocks[i]);
        }
    }
}

// iframe-style-injector.js에 이 함수를 통합하려면:
// enhanceCodeBlocks 함수 내에서 다음 코드를 추가하세요:
/*
    // 모든 코드 블록에 Python 구문 강조 적용
    setTimeout(function() {
        applyPythonSyntaxHighlighting(doc);
    }, 100);
*/