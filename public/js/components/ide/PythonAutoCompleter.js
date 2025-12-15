/**
 * PythonAutoCompleter.js - Python 자동완성 컴포넌트
 * ACE 에디터용 Python 키워드, 내장함수, 메서드 자동완성 기능
 */

class PythonAutoCompleter {
  constructor(options = {}) {
    // 기본 옵션 설정
    this.options = {
      elementId: 'python-autocompleter',
      enableLiveAutocompletion: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      ...options
    };

    // 상태 관리
    this.state = {
      editor: null,
      isInitialized: false,
      completionCache: new Map()
    };

    // Python 언어 데이터 초기화
    this.initializePythonData();
  }

  /**
   * Python 언어 데이터 초기화
   */
  initializePythonData() {
    // Python 키워드 목록
    this.pythonKeywords = [
      "and", "as", "assert", "break", "class", "continue", "def", "del",
      "elif", "else", "except", "exec", "finally", "for", "from", "global",
      "if", "import", "in", "is", "lambda", "not", "or", "pass", "print",
      "raise", "return", "try", "while", "with", "yield", "async", "await",
      "nonlocal", "True", "False", "None"
    ];

    // Python 내장함수 목록
    this.pythonBuiltins = [
      "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes",
      "callable", "chr", "classmethod", "compile", "complex", "delattr",
      "dict", "dir", "divmod", "enumerate", "eval", "exec", "filter",
      "float", "format", "frozenset", "getattr", "globals", "hasattr",
      "hash", "help", "hex", "id", "input", "int", "isinstance",
      "issubclass", "iter", "len", "list", "locals", "map", "max",
      "memoryview", "min", "next", "object", "oct", "open", "ord",
      "pow", "print", "property", "range", "repr", "reversed", "round",
      "set", "setattr", "slice", "sorted", "staticmethod", "str", "sum",
      "super", "tuple", "type", "vars", "zip", "__import__"
    ];

    // 클래스별 메서드 목록
    this.commonMethods = {
      "list": [
        "append", "clear", "copy", "count", "extend", "index",
        "insert", "pop", "remove", "reverse", "sort"
      ],
      "dict": [
        "clear", "copy", "fromkeys", "get", "items", "keys",
        "pop", "popitem", "setdefault", "update", "values"
      ],
      "str": [
        "capitalize", "casefold", "center", "count", "encode", "endswith",
        "expandtabs", "find", "format", "format_map", "index", "isalnum",
        "isalpha", "isdecimal", "isdigit", "islower", "isnumeric",
        "isprintable", "isspace", "istitle", "isupper", "join", "ljust",
        "lower", "lstrip", "maketrans", "partition", "replace", "rfind",
        "rindex", "rjust", "rpartition", "rsplit", "rstrip", "split",
        "splitlines", "startswith", "strip", "swapcase", "title",
        "translate", "upper", "zfill"
      ],
      "set": [
        "add", "clear", "copy", "difference", "difference_update",
        "discard", "intersection", "intersection_update", "isdisjoint",
        "issubset", "issuperset", "pop", "remove", "symmetric_difference",
        "symmetric_difference_update", "union", "update"
      ],
      "tuple": [
        "count", "index"
      ]
    };

    // Python 모듈별 함수 (자주 사용되는 것들)
    this.moduleCompletions = {
      "math": [
        "ceil", "floor", "sqrt", "pow", "exp", "log", "log10", "sin",
        "cos", "tan", "asin", "acos", "atan", "degrees", "radians", "pi", "e"
      ],
      "random": [
        "random", "randint", "choice", "choices", "shuffle", "sample",
        "uniform", "gauss", "seed"
      ],
      "os": [
        "getcwd", "chdir", "listdir", "mkdir", "makedirs", "remove",
        "rename", "path", "environ", "system"
      ],
      "sys": [
        "argv", "exit", "path", "version", "platform", "stdin", "stdout", "stderr"
      ],
      "datetime": [
        "datetime", "date", "time", "timedelta", "now", "today", "strftime", "strptime"
      ]
    };

    // 코드 스니펫
    this.snippets = {
      "def": "def ${1:function_name}(${2:parameters}):\n    ${3:pass}",
      "class": "class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}",
      "if": "if ${1:condition}:\n    ${2:pass}",
      "for": "for ${1:item} in ${2:iterable}:\n    ${3:pass}",
      "while": "while ${1:condition}:\n    ${2:pass}",
      "try": "try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}",
      "with": "with ${1:expression} as ${2:variable}:\n    ${3:pass}",
      "main": "if __name__ == '__main__':\n    ${1:pass}"
    };
  }

  /**
   * 컴포넌트 초기화
   */
  async init(editorInstance = null) {
    console.log('PythonAutoCompleter 초기화 시작');

    try {
      // 에디터 인스턴스 설정
      if (editorInstance) {
        this.state.editor = editorInstance;
      }

      // ACE 에디터 language tools 확인
      if (!this.checkAceDependencies()) {
        throw new Error('ACE 에디터 language tools를 찾을 수 없습니다');
      }

      // 자동완성 설정
      this.setupAutoCompletion();

      this.state.isInitialized = true;
      console.log('PythonAutoCompleter 초기화 완료');
      return true;

    } catch (error) {
      console.error('PythonAutoCompleter 초기화 오류:', error);
      return false;
    }
  }

  /**
   * ACE 에디터 의존성 확인
   */
  checkAceDependencies() {
    try {
      if (typeof ace === 'undefined') {
        console.error('ACE 에디터가 로드되지 않았습니다');
        return false;
      }

      ace.require("ace/ext/language_tools");
      return true;
    } catch (error) {
      console.error('ACE 에디터 language_tools 확장을 로드할 수 없습니다:', error);
      return false;
    }
  }

  /**
   * 에디터에 자동완성 설정 적용
   */
  setupForEditor(editor) {
    if (!editor) {
      console.error('유효하지 않은 에디터 인스턴스');
      return false;
    }

    this.state.editor = editor;
    return this.setupAutoCompletion();
  }

  /**
   * 자동완성 설정
   */
  setupAutoCompletion() {
    if (!this.state.editor) {
      console.error('에디터 인스턴스가 설정되지 않았습니다');
      return false;
    }

    try {
      const langTools = ace.require("ace/ext/language_tools");

      // 기존 completers 제거 후 새로 설정
      this.state.editor.completers = [];

      // Python 자동완성 completer 추가
      const pythonCompleter = this.createPythonCompleter();
      this.state.editor.completers.push(pythonCompleter);

      // 에디터 자동완성 옵션 설정
      this.state.editor.setOptions({
        enableLiveAutocompletion: this.options.enableLiveAutocompletion,
        enableBasicAutocompletion: this.options.enableBasicAutocompletion,
        enableSnippets: this.options.enableSnippets
      });

      // UI 설정
      this.setupAutoCompleteUI();

      // 키보드 단축키 설정
      this.setupKeyboardShortcuts();

      console.log('Python 자동완성 설정 완료');
      return true;

    } catch (error) {
      console.error('자동완성 설정 오류:', error);
      return false;
    }
  }

  /**
   * Python Completer 생성
   */
  createPythonCompleter() {
    return {
      getCompletions: (editor, session, pos, prefix, callback) => {
        try {
          const completions = this.generateCompletions(editor, session, pos, prefix);
          callback(null, completions);
        } catch (error) {
          console.error('자동완성 생성 오류:', error);
          callback(null, []);
        }
      }
    };
  }

  /**
   * 자동완성 항목 생성
   */
  generateCompletions(editor, session, pos, prefix) {
    const completions = [];
    const currentLine = session.getLine(pos.row);
    const context = this.analyzeContext(currentLine, pos.column);

    // 캐시 키 생성
    const cacheKey = `${prefix}_${context.type}_${context.object}`;
    if (this.state.completionCache.has(cacheKey)) {
      return this.state.completionCache.get(cacheKey);
    }

    // 컨텍스트에 따른 완성 항목 생성
    switch (context.type) {
      case 'method':
        this.addMethodCompletions(completions, context.object, prefix);
        break;
      case 'module':
        this.addModuleCompletions(completions, context.module, prefix);
        break;
      case 'import':
        this.addImportCompletions(completions, prefix);
        break;
      default:
        this.addGeneralCompletions(completions, prefix);
        break;
    }

    // 캐시에 저장 (최대 100개 항목)
    if (this.state.completionCache.size > 100) {
      const firstKey = this.state.completionCache.keys().next().value;
      this.state.completionCache.delete(firstKey);
    }
    this.state.completionCache.set(cacheKey, completions);

    return completions;
  }

  /**
   * 컨텍스트 분석
   */
  analyzeContext(line, column) {
    const beforeCursor = line.substring(0, column);

    // 메서드 호출 패턴 확인 (예: obj.method)
    const methodMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
    if (methodMatch) {
      return {
        type: 'method',
        object: methodMatch[1],
        partial: methodMatch[2]
      };
    }

    // 모듈 함수 호출 패턴 확인 (예: math.sqrt)
    const moduleMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
    if (moduleMatch && this.moduleCompletions[moduleMatch[1]]) {
      return {
        type: 'module',
        module: moduleMatch[1],
        partial: moduleMatch[2]
      };
    }

    // import 문 확인
    if (beforeCursor.match(/^\s*(import|from)\s+/)) {
      return { type: 'import' };
    }

    return { type: 'general' };
  }

  /**
   * 메서드 자동완성 추가
   */
  addMethodCompletions(completions, objectName, prefix) {
    // 객체 타입 추론 (간단한 휴리스틱)
    let objectType = this.inferObjectType(objectName);

    if (objectType && this.commonMethods[objectType]) {
      this.commonMethods[objectType].forEach(method => {
        if (method.toLowerCase().startsWith(prefix.toLowerCase())) {
          completions.push({
            caption: method,
            value: method,
            meta: `${objectType} method`,
            score: 1000,
            docHTML: this.getMethodDocumentation(objectType, method)
          });
        }
      });
    }
  }

  /**
   * 모듈 함수 자동완성 추가
   */
  addModuleCompletions(completions, moduleName, prefix) {
    if (this.moduleCompletions[moduleName]) {
      this.moduleCompletions[moduleName].forEach(func => {
        if (func.toLowerCase().startsWith(prefix.toLowerCase())) {
          completions.push({
            caption: func,
            value: func,
            meta: `${moduleName} function`,
            score: 950,
            docHTML: this.getModuleFunctionDocumentation(moduleName, func)
          });
        }
      });
    }
  }

  /**
   * import 자동완성 추가
   */
  addImportCompletions(completions, prefix) {
    const commonModules = Object.keys(this.moduleCompletions);
    commonModules.forEach(module => {
      if (module.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          caption: module,
          value: module,
          meta: 'module',
          score: 900
        });
      }
    });
  }

  /**
   * 일반 자동완성 추가
   */
  addGeneralCompletions(completions, prefix) {
    // 키워드 추가
    this.pythonKeywords.forEach(keyword => {
      if (keyword.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          caption: keyword,
          value: keyword,
          meta: 'keyword',
          score: 1000
        });
      }
    });

    // 내장함수 추가
    this.pythonBuiltins.forEach(builtin => {
      if (builtin.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          caption: builtin,
          value: builtin,
          meta: 'builtin',
          score: 950,
          docHTML: this.getBuiltinDocumentation(builtin)
        });
      }
    });

    // 스니펫 추가
    Object.keys(this.snippets).forEach(snippet => {
      if (snippet.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          caption: snippet,
          snippet: this.snippets[snippet],
          meta: 'snippet',
          score: 800
        });
      }
    });
  }

  /**
   * 객체 타입 추론 (간단한 휴리스틱)
   */
  inferObjectType(objectName) {
    // 변수명으로 타입 추론
    const typeHints = {
      'list': 'list', 'lst': 'list', 'items': 'list',
      'dict': 'dict', 'dictionary': 'dict', 'data': 'dict',
      'str': 'str', 'string': 'str', 'text': 'str', 'name': 'str',
      'set': 'set', 'unique': 'set',
      'tuple': 'tuple', 'tup': 'tuple'
    };

    return typeHints[objectName.toLowerCase()] || null;
  }

  /**
   * 메서드 문서화 정보 가져오기
   */
  getMethodDocumentation(objectType, method) {
    const docs = {
      'list': {
        'append': 'list.append(x) - 리스트 끝에 항목을 추가합니다',
        'pop': 'list.pop([i]) - 지정된 위치의 항목을 제거하고 반환합니다',
        'sort': 'list.sort() - 리스트를 정렬합니다'
      },
      'dict': {
        'get': 'dict.get(key[, default]) - 키에 해당하는 값을 반환합니다',
        'keys': 'dict.keys() - 딕셔너리의 모든 키를 반환합니다',
        'values': 'dict.values() - 딕셔너리의 모든 값을 반환합니다'
      },
      'str': {
        'split': 'str.split([sep]) - 문자열을 분할하여 리스트로 반환합니다',
        'join': 'str.join(iterable) - 이터러블의 요소들을 문자열로 연결합니다',
        'replace': 'str.replace(old, new) - 문자열의 일부를 다른 문자열로 교체합니다'
      }
    };

    return docs[objectType] && docs[objectType][method] || `${objectType}.${method}()`;
  }

  /**
   * 모듈 함수 문서화 정보 가져오기
   */
  getModuleFunctionDocumentation(moduleName, funcName) {
    const docs = {
      'math': {
        'sqrt': 'math.sqrt(x) - x의 제곱근을 반환합니다',
        'pow': 'math.pow(x, y) - x의 y제곱을 반환합니다',
        'ceil': 'math.ceil(x) - x보다 크거나 같은 가장 작은 정수를 반환합니다'
      },
      'random': {
        'randint': 'random.randint(a, b) - a와 b 사이의 임의의 정수를 반환합니다',
        'choice': 'random.choice(seq) - 시퀀스에서 임의의 요소를 선택합니다'
      }
    };

    return docs[moduleName] && docs[moduleName][funcName] || `${moduleName}.${funcName}()`;
  }

  /**
   * 내장함수 문서화 정보 가져오기
   */
  getBuiltinDocumentation(builtin) {
    const docs = {
      'len': 'len(obj) - 객체의 길이를 반환합니다',
      'print': 'print(*values, sep=" ", end="\\n") - 값들을 출력합니다',
      'input': 'input([prompt]) - 사용자 입력을 받습니다',
      'range': 'range([start], stop[, step]) - 숫자 범위를 생성합니다',
      'type': 'type(obj) - 객체의 타입을 반환합니다'
    };

    return docs[builtin] || `${builtin}() - Python 내장함수`;
  }

  /**
   * 자동완성 UI 설정
   */
  setupAutoCompleteUI() {
    // CSS 스타일 추가
    if (!document.getElementById('python-autocomplete-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'python-autocomplete-styles';
      styleSheet.textContent = `
        .ace_autocomplete {
          width: 350px !important;
          max-height: 400px !important;
          z-index: 10000 !important;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
          font-size: 14px !important;
        }
        
        .ace_autocomplete .ace_completion-highlight {
          color: #ffd700 !important;
          font-weight: bold !important;
        }
        
        .ace_autocomplete .ace_completion-meta {
          color: #888 !important;
          font-style: italic !important;
        }
        
        .ace_autocomplete .ace_selected {
          background-color: #0066cc !important;
          color: white !important;
        }
        
        .ace_autocomplete .ace_line {
          padding: 2px 5px !important;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }

  /**
   * 키보드 단축키 설정
   */
  setupKeyboardShortcuts() {
    if (!this.state.editor) return;

    // Ctrl+Space로 자동완성 호출
    this.state.editor.commands.addCommand({
      name: "showPythonCompletions",
      bindKey: { win: "Ctrl-Space", mac: "Command-Space" },
      exec: (editor) => {
        if (!editor.completer) {
          const Autocomplete = ace.require("ace/autocomplete").Autocomplete;
          editor.completer = new Autocomplete();
        }
        editor.completer.showPopup(editor);
      }
    });

    // Tab으로 스니펫 확장
    this.state.editor.commands.addCommand({
      name: "expandSnippet",
      bindKey: "Tab",
      exec: (editor) => {
        const snippetManager = ace.require("ace/snippets").snippetManager;
        return snippetManager.expandWithTab(editor);
      }
    });
  }

  /**
   * 에디터 활성화 및 초기 설정
   */
  activate() {
    console.log('PythonAutoCompleter 활성화');

    // 거터 너비 강제 설정 로직 제거
    /*
    if (this.state.editor) {
      this.forceGutterWidth();
    }
    */
  }



  /**
   * 자동완성 활성화
   */
  enable() {
    if (this.state.editor) {
      this.state.editor.setOptions({
        enableLiveAutocompletion: this.options.enableLiveAutocompletion,
        enableBasicAutocompletion: this.options.enableBasicAutocompletion,
        enableSnippets: this.options.enableSnippets
      });
    }
  }

  /**
   * 자동완성 비활성화
   */
  disable() {
    if (this.state.editor) {
      this.state.editor.setOptions({
        enableLiveAutocompletion: false,
        enableBasicAutocompletion: false,
        enableSnippets: false
      });
    }
  }

  /**
   * 캐시 지우기
   */
  clearCache() {
    this.state.completionCache.clear();
  }

  /**
   * 컴포넌트 정리
   */
  destroy() {
    console.log('PythonAutoCompleter 정리 시작');

    // 캐시 지우기
    this.clearCache();

    // 에디터 참조 제거
    this.state.editor = null;
    this.state.isInitialized = false;

    // 스타일 제거
    const styleElement = document.getElementById('python-autocomplete-styles');
    if (styleElement) {
      styleElement.remove();
    }

    console.log('PythonAutoCompleter 정리 완료');
  }
}

// 전역 스코프에 노출
window.PythonAutoCompleter = PythonAutoCompleter;