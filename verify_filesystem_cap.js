const PythonRunner = require('./lib_execution/PythonRunner');

async function testFileSystem() {
    console.log('--- Testing File I/O Capability ---');
    const runner = new PythonRunner();

    const code = `
# 1. 파일 쓰기
with open('data.txt', 'w', encoding='utf-8') as f:
    f.write('Hello from Python File System!')

# 2. 파일 읽기
with open('data.txt', 'r', encoding='utf-8') as f:
    content = f.read()
    print(f"Read Content: {content}")

# 3. 모듈 테스트
import my_math
print(f"Module Result: {my_math.add(10, 20)}")
`;

    const moduleCode = `
def add(a, b):
    return a + b
`;

    const files = [
        { path: 'main.py', content: code },
        { path: 'my_math.py', content: moduleCode }
    ];

    try {
        const result = await runner.execute(files, 'main.py');
        console.log('Stdout:', result.stdout);
        console.log('Stderr:', result.stderr);

        if (result.stdout.includes('Hello from Python File System!') && result.stdout.includes('Module Result: 30')) {
            console.log('✅ PASS: File I/O and Modules are working!');
        } else {
            console.error('❌ FAIL: Output mismatch');
        }

    } catch (e) {
        console.error('❌ FAIL: Execution error', e);
    }
}

testFileSystem();
