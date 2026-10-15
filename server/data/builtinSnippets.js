



const BUILT_IN_SNIPPETS = [
  
  {
    name: 'For loop', prefix: 'for', language: 'python', category: 'loops',
    description: 'For loop over range',
    code: 'for ${1:i} in range(${2:0}, ${3:n}):\n    ${0:pass}',
  },
  {
    name: 'For each', prefix: 'foreach', language: 'python', category: 'loops',
    description: 'For loop over iterable',
    code: 'for ${1:item} in ${2:items}:\n    ${0:pass}',
  },
  {
    name: 'While loop', prefix: 'while', language: 'python', category: 'loops',
    description: 'While loop',
    code: 'while ${1:condition}:\n    ${0:pass}',
  },
  {
    name: 'Function', prefix: 'def', language: 'python', category: 'functions',
    description: 'Function definition',
    code: 'def ${1:name}(${2:args}):\n    ${0:pass}',
  },
  {
    name: 'Class', prefix: 'class', language: 'python', category: 'oop',
    description: 'Class definition',
    code: 'class ${1:Name}:\n    def __init__(self${2:, args}):\n        ${0:pass}',
  },
  {
    name: 'Try except', prefix: 'try', language: 'python', category: 'error-handling',
    description: 'Try/except block',
    code: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${0:print(e)}',
  },
  {
    name: 'If main', prefix: 'main', language: 'python', category: 'boilerplate',
    description: 'if __name__ == main guard',
    code: 'if __name__ == "__main__":\n    ${0:main()}',
  },
  {
    name: 'List comprehension', prefix: 'listcomp', language: 'python', category: 'loops',
    description: 'List comprehension',
    code: '[${1:expr} for ${2:x} in ${3:iterable}]',
  },
  {
    name: 'Binary search', prefix: 'binsearch', language: 'python', category: 'algorithms',
    description: 'Binary search template',
    code: 'def binary_search(${1:arr}, ${2:target}):\n    lo, hi = 0, len(${1:arr}) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if ${1:arr}[mid] == ${2:target}:\n            return mid\n        elif ${1:arr}[mid] < ${2:target}:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return ${0:-1}',
  },
  {
    name: 'DFS', prefix: 'dfs', language: 'python', category: 'algorithms',
    description: 'Depth-first search template',
    code: 'def dfs(${1:node}, ${2:visited}):\n    ${2:visited}.add(${1:node})\n    for ${3:nei} in ${4:graph}[${1:node}]:\n        if ${3:nei} not in ${2:visited}:\n            ${0:dfs(${3:nei}, ${2:visited})}',
  },
  
  {
    name: 'For loop', prefix: 'for', language: 'cpp', category: 'loops',
    description: 'For loop',
    code: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}',
  },
  {
    name: 'While loop', prefix: 'while', language: 'cpp', category: 'loops',
    description: 'While loop',
    code: 'while (${1:condition}) {\n    ${0}\n}',
  },
  {
    name: 'Function', prefix: 'func', language: 'cpp', category: 'functions',
    description: 'Function definition',
    code: '${1:void} ${2:name}(${3:args}) {\n    ${0}\n}',
  },
  {
    name: 'Class', prefix: 'class', language: 'cpp', category: 'oop',
    description: 'Class definition',
    code: 'class ${1:Name} {\npublic:\n    ${1:Name}() {\n        ${0}\n    }\n};',
  },
  {
    name: 'Vector', prefix: 'vec', language: 'cpp', category: 'stl',
    description: 'Vector declaration',
    code: 'vector<${1:int}> ${2:arr};',
  },
  {
    name: 'Main', prefix: 'main', language: 'cpp', category: 'boilerplate',
    description: 'Main function with fast IO',
    code: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    ${0}\n    return 0;\n}',
  },
  {
    name: 'Binary search', prefix: 'binsearch', language: 'cpp', category: 'algorithms',
    description: 'Binary search template',
    code: 'int lo = 0, hi = ${1:n} - 1;\nwhile (lo <= hi) {\n    int mid = lo + (hi - lo) / 2;\n    if (${2:arr}[mid] == ${3:target}) ${0:return mid;}\n    else if (${2:arr}[mid] < ${3:target}) lo = mid + 1;\n    else hi = mid - 1;\n}\nreturn -1;',
  },
  
  {
    name: 'Main class', prefix: 'main', language: 'java', category: 'boilerplate',
    description: 'Main class with psvm',
    code: 'public class ${1:Main} {\n    public static void main(String[] args) {\n        ${0}\n    }\n}',
  },
  {
    name: 'For loop', prefix: 'for', language: 'java', category: 'loops',
    description: 'For loop',
    code: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}',
  },
  {
    name: 'Sout', prefix: 'sout', language: 'java', category: 'io',
    description: 'System.out.println',
    code: 'System.out.println(${1});',
  },
  {
    name: 'Scanner', prefix: 'scanner', language: 'java', category: 'io',
    description: 'Scanner for input',
    code: 'Scanner ${1:sc} = new Scanner(System.in);',
  },
  
  {
    name: 'Arrow function', prefix: 'arrow', language: 'javascript', category: 'functions',
    description: 'Arrow function',
    code: 'const ${1:name} = (${2:args}) => {\n    ${0}\n};',
  },
  {
    name: 'For loop', prefix: 'for', language: 'javascript', category: 'loops',
    description: 'For loop',
    code: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}',
  },
  {
    name: 'Console log', prefix: 'log', language: 'javascript', category: 'io',
    description: 'console.log',
    code: 'console.log(${1});',
  },
  {
    name: 'Fetch', prefix: 'fetch', language: 'javascript', category: 'async',
    description: 'Fetch with async/await',
    code: 'const res = await fetch(${1:url});\nconst data = await res.json();\n${0}',
  },
];

module.exports = { BUILT_IN_SNIPPETS };
