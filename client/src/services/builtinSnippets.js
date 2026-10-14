// Built-in editor snippets for Synapse (VS Code parity pack).
// Plain data only — no functions. Each entry matches the snippet shape used
// by client/src/services/snippetProvider.js:
//   { name, prefix, description, category, language, code }
// `code` uses Monaco snippet syntax: ${1:placeholder} tabstops, $0 final
// cursor, and mirrored tabstops (same number reused) where useful.

export const BUILT_IN_SNIPPETS = [
  // ── React (language: javascript) ──────────────────────────────────────────
  { name: 'React Function Component (export default)', prefix: 'rfce', description: 'Import React + function component + export default', category: 'React', language: 'javascript', code: "import React from 'react';\n\nfunction ${1:ComponentName}() {\n\treturn (\n\t\t<div>$0</div>\n\t);\n}\n\nexport default ${1:ComponentName};" },
  { name: 'React Arrow Function Component (export default)', prefix: 'rafce', description: 'Import React + arrow function component + export default', category: 'React', language: 'javascript', code: "import React from 'react';\n\nconst ${1:ComponentName} = () => {\n\treturn <div>$0</div>;\n};\n\nexport default ${1:ComponentName};" },
  { name: 'React Function Component', prefix: 'rfc', description: 'React function component with export default', category: 'React', language: 'javascript', code: "import React from 'react';\n\nexport default function ${1:ComponentName}() {\n\treturn <div>$0</div>;\n}" },
  { name: 'useState hook', prefix: 'usestate', description: 'React useState hook declaration', category: 'React', language: 'javascript', code: 'const [${1:state}, ${2:setState}] = useState(${3:null});$0' },
  { name: 'useEffect hook', prefix: 'useeffect', description: 'React useEffect hook with dependency array', category: 'React', language: 'javascript', code: 'useEffect(() => {\n\t${1:// effect}\n\t$0\n}, [${2:deps}]);' },
  { name: 'useEffect hook with cleanup', prefix: 'useeffectc', description: 'React useEffect hook with cleanup return function', category: 'React', language: 'javascript', code: 'useEffect(() => {\n\t${1:// effect}\n\treturn () => {\n\t\t${2:// cleanup}\n\t};\n}, [${3:deps}]);$0' },
  { name: 'useRef hook', prefix: 'useref', description: 'React useRef hook declaration', category: 'React', language: 'javascript', code: 'const ${1:ref} = useRef(${2:null});$0' },
  { name: 'useContext hook', prefix: 'usecontext', description: 'React useContext hook declaration', category: 'React', language: 'javascript', code: 'const ${1:value} = useContext(${2:Context});$0' },
  { name: 'useMemo hook', prefix: 'usememo', description: 'React useMemo hook declaration', category: 'React', language: 'javascript', code: 'const ${1:memoized} = useMemo(() => {\n\treturn ${2:value};\n}, [${3:deps}]);$0' },
  { name: 'useCallback hook', prefix: 'usecallback', description: 'React useCallback hook declaration', category: 'React', language: 'javascript', code: 'const ${1:callback} = useCallback((${2:args}) => {\n\t$0\n}, [${3:deps}]);' },
  { name: 'Import React', prefix: 'imr', description: 'Import React from react', category: 'React', language: 'javascript', code: "import React from 'react';$0" },
  { name: 'Import React with useState', prefix: 'imrs', description: 'Import React and useState from react', category: 'React', language: 'javascript', code: "import React, { useState } from 'react';$0" },
  { name: 'Export Default Function Component', prefix: 'edf', description: 'Export default function component', category: 'React', language: 'javascript', code: 'export default function ${1:ComponentName}() {\n\treturn <div>$0</div>;\n}' },
  { name: 'React .map to JSX', prefix: 'rmap', description: 'Map an array to JSX elements with key', category: 'React', language: 'javascript', code: '{${1:items}.map((${2:item}, ${3:index}) => (\n\t<div key={${3:index}}>$0</div>\n))}' },
  { name: 'React Conditional Render (&&)', prefix: 'rcond', description: 'Conditional render with && operator', category: 'React', language: 'javascript', code: '{${1:condition} && (\n\t<div>$0</div>\n)}' },
  { name: 'React Conditional Render (ternary)', prefix: 'rternary', description: 'Conditional render with ternary operator', category: 'React', language: 'javascript', code: '{${1:condition} ? (\n\t<div>$0</div>\n) : (\n\t<div>${2:fallback}</div>\n)}' },

  // ── JavaScript ─────────────────────────────────────────────────────────────
  { name: 'console.log', prefix: 'clg', description: 'Log a value to the console', category: 'JavaScript', language: 'javascript', code: 'console.log(${1:value});$0' },
  { name: 'console.log labeled object', prefix: 'clo', description: 'Log a labeled object to the console', category: 'JavaScript', language: 'javascript', code: "console.log('${1:label}:', ${2:obj});$0" },
  { name: 'Arrow function', prefix: 'afn', description: 'Arrow function assigned to a const', category: 'JavaScript', language: 'javascript', code: 'const ${1:name} = (${2:args}) => {\n\t$0\n};' },
  { name: 'Function declaration', prefix: 'fn', description: 'Named function declaration', category: 'JavaScript', language: 'javascript', code: 'function ${1:name}(${2:args}) {\n\t$0\n}' },
  { name: 'Async arrow function', prefix: 'aaf', description: 'Async arrow function assigned to a const', category: 'JavaScript', language: 'javascript', code: 'const ${1:name} = async (${2:args}) => {\n\t$0\n};' },
  { name: 'try/catch', prefix: 'trycatch', description: 'try/catch block with console.error', category: 'JavaScript', language: 'javascript', code: 'try {\n\t$1\n} catch (${2:error}) {\n\tconsole.error(${2:error});$0\n}' },
  { name: 'for...of loop', prefix: 'forof', description: 'for...of loop over an iterable', category: 'JavaScript', language: 'javascript', code: 'for (const ${1:item} of ${2:iterable}) {\n\t$0\n}' },
  { name: 'Array.map', prefix: 'formap', description: 'Array.map producing a new array', category: 'JavaScript', language: 'javascript', code: 'const ${1:result} = ${2:array}.map((${3:item}) => {\n\treturn $0;\n});' },
  { name: 'Array.filter', prefix: 'forfilter', description: 'Array.filter producing a filtered array', category: 'JavaScript', language: 'javascript', code: 'const ${1:result} = ${2:array}.filter((${3:item}) => {\n\treturn $0;\n});' },
  { name: 'Array.forEach', prefix: 'foreach', description: 'Array.forEach iteration', category: 'JavaScript', language: 'javascript', code: '${1:array}.forEach((${2:item}) => {\n\t$0\n});' },
  { name: 'Promise', prefix: 'promise', description: 'New Promise with resolve and reject', category: 'JavaScript', language: 'javascript', code: 'new Promise((${1:resolve}, ${2:reject}) => {\n\t$0\n});' },
  { name: 'fetch GET with JSON', prefix: 'fetchget', description: 'async fetch GET request parsing JSON, wrapped in try/catch', category: 'JavaScript', language: 'javascript', code: 'try {\n\tconst response = await fetch(${1:url});\n\tconst data = await response.json();\n\t$0\n} catch (${2:error}) {\n\tconsole.error(${2:error});\n}' },
  { name: 'fetch POST with JSON', prefix: 'fetchpost', description: 'async fetch POST request with JSON body, wrapped in try/catch', category: 'JavaScript', language: 'javascript', code: "try {\n\tconst response = await fetch(${1:url}, {\n\t\tmethod: 'POST',\n\t\theaders: { 'Content-Type': 'application/json' },\n\t\tbody: JSON.stringify(${2:data}),\n\t});\n\tconst result = await response.json();\n\t$0\n} catch (${3:error}) {\n\tconsole.error(${3:error});\n}" },

  // ── Node ──────────────────────────────────────────────────────────────────
  { name: 'Express server boilerplate', prefix: 'expressserver', description: 'Full Express app boilerplate with cors, JSON body parsing and listen', category: 'Node', language: 'javascript', code: "const express = require('express');\nconst cors = require('cors');\n\nconst app = express();\nconst PORT = process.env.PORT || ${1:5000};\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/', (req, res) => {\n\tres.json({ message: '${2:API running}' });\n});\n\napp.listen(PORT, () => {\n\tconsole.log(`Server running on port \\${PORT}`);\n});$0" },
  { name: 'Express route handler', prefix: 'expressroute', description: 'Express app.METHOD route handler', category: 'Node', language: 'javascript', code: "app.${1:get}('${2:/path}', (req, res) => {\n\t$0\n\tres.json({});\n});" },
  { name: 'Mongoose model', prefix: 'mongomodel', description: 'Mongoose schema plus model export with timestamps', category: 'Node', language: 'javascript', code: "const mongoose = require('mongoose');\n\nconst ${1:Item}Schema = new mongoose.Schema({\n\tname: { type: String, required: true },\n\t$0\n}, { timestamps: true });\n\nmodule.exports = mongoose.model('${1:Item}', ${1:Item}Schema);" },
  { name: 'Async Express handler (req, res)', prefix: 'reqres', description: 'Async Express (req, res) handler with try/catch returning 500 on error', category: 'Node', language: 'javascript', code: "const ${1:handler} = async (req, res) => {\n\ttry {\n\t\t$0\n\t\tres.json({});\n\t} catch (error) {\n\t\tconsole.error(error);\n\t\tres.status(500).json({ message: 'Server error' });\n\t}\n};" },

  // ── HTML ───────────────────────────────────────────────────────────────────
  { name: 'HTML5 boilerplate', prefix: '!', description: 'Full HTML5 document boilerplate with meta, viewport, CSS link and JS script', category: 'HTML', language: 'html', code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:styles.css}" />\n</head>\n<body>\n\t$0\n\t<script src="${3:script.js}"></script>\n</body>\n</html>' },
  { name: 'HTML form', prefix: 'form', description: 'Form with an input and a submit button', category: 'HTML', language: 'html', code: '<form action="${1:/submit}" method="${2:post}">\n\t<input type="${3:text}" name="${4:name}" placeholder="${5:placeholder}" />\n\t<button type="submit">${6:Submit}</button>$0\n</form>' },
  { name: 'HTML table', prefix: 'table', description: 'Table with thead and tbody skeleton', category: 'HTML', language: 'html', code: '<table>\n\t<thead>\n\t\t<tr>\n\t\t\t<th>${1:Header}</th>\n\t\t</tr>\n\t</thead>\n\t<tbody>\n\t\t<tr>\n\t\t\t<td>$0</td>\n\t\t</tr>\n\t</tbody>\n</table>' },
  { name: 'Unordered list', prefix: 'ullist', description: 'Unordered list with two list items', category: 'HTML', language: 'html', code: '<ul>\n\t<li>${1:item}</li>\n\t<li>$0</li>\n</ul>' },
  { name: 'Image tag', prefix: 'img', description: 'Image tag with src and alt', category: 'HTML', language: 'html', code: '<img src="${1:src}" alt="${2:alt}" />$0' },
  { name: 'Anchor link', prefix: 'alink', description: 'Anchor link tag', category: 'HTML', language: 'html', code: '<a href="${1:url}">${2:link text}</a>$0' },
  { name: 'Input field', prefix: 'input', description: 'Input field with type, name and placeholder', category: 'HTML', language: 'html', code: '<input type="${1:text}" name="${2:name}" placeholder="${3:placeholder}" />$0' },
  { name: 'Button', prefix: 'btn', description: 'Button element', category: 'HTML', language: 'html', code: '<button type="${1:button}">${2:Click me}</button>$0' },
  { name: 'Card div', prefix: 'card', description: 'Card div structure with header and body', category: 'HTML', language: 'html', code: '<div class="card">\n\t<div class="card-header">${1:Title}</div>\n\t<div class="card-body">\n\t\t$0\n\t</div>\n</div>' },
  { name: 'Nav bar', prefix: 'nav', description: 'Navigation bar with a link list', category: 'HTML', language: 'html', code: '<nav>\n\t<ul>\n\t\t<li><a href="${1:#}">${2:Home}</a></li>\n\t\t<li><a href="#">$0</a></li>\n\t</ul>\n</nav>' },

  // ── CSS ────────────────────────────────────────────────────────────────────
  { name: 'Flexbox centering', prefix: 'flexcenter', description: 'Center content with flexbox', category: 'CSS', language: 'css', code: 'display: flex;\njustify-content: center;\nalign-items: center;$0' },
  { name: 'CSS grid layout', prefix: 'gridlay', description: 'Grid layout with equal columns and gap', category: 'CSS', language: 'css', code: 'display: grid;\ngrid-template-columns: repeat(${1:3}, 1fr);\ngap: ${2:1rem};$0' },
  { name: 'Media query', prefix: 'mediaq', description: 'Media query for a max-width breakpoint', category: 'CSS', language: 'css', code: '@media (max-width: ${1:768px}) {\n\t$0\n}' },
  { name: 'CSS reset', prefix: 'reset', description: 'Universal reset with border-box sizing', category: 'CSS', language: 'css', code: '* {\n\tmargin: 0;\n\tpadding: 0;\n\tbox-sizing: border-box;\n}$0' },
  { name: 'Absolute centering', prefix: 'abscenter', description: 'Center an element with absolute positioning and transform', category: 'CSS', language: 'css', code: 'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);$0' },
  { name: 'Custom scrollbar', prefix: 'scrollbar', description: 'Styled webkit scrollbar with track and thumb', category: 'CSS', language: 'css', code: '::-webkit-scrollbar {\n\twidth: ${1:10px};\n}\n::-webkit-scrollbar-track {\n\tbackground: ${2:#f1f1f1};\n}\n::-webkit-scrollbar-thumb {\n\tbackground: ${3:#888};\n}$0' },
  { name: 'Text ellipsis', prefix: 'textellipsis', description: 'Single-line text truncation with ellipsis', category: 'CSS', language: 'css', code: 'white-space: nowrap;\noverflow: hidden;\ntext-overflow: ellipsis;$0' },
  { name: 'Keyframes animation', prefix: 'keyframes', description: 'CSS @keyframes animation block', category: 'CSS', language: 'css', code: '@keyframes ${1:fadeIn} {\n\tfrom {\n\t\t$0\n\t}\n\tto {\n\t}\n}' },

  // ── Python ─────────────────────────────────────────────────────────────────
  { name: 'Python main guard', prefix: 'main', description: 'if __name__ == "__main__" guard block', category: 'Python', language: 'python', code: 'if __name__ == "__main__":\n\t$0' },
  { name: 'Python function', prefix: 'def', description: 'Function definition with return', category: 'Python', language: 'python', code: 'def ${1:name}(${2:args}):\n\t$0\n\treturn ${3:None}' },
  { name: 'Python class', prefix: 'class', description: 'Class with an __init__ constructor', category: 'Python', language: 'python', code: 'class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t$0' },
  { name: 'Python __init__', prefix: 'classinit', description: '__init__ constructor assigning an attribute', category: 'Python', language: 'python', code: 'def __init__(self${1:, args}):\n\tself.${2:attr} = ${3:value}$0' },
  { name: 'Python try/except', prefix: 'try', description: 'try/except block printing the error', category: 'Python', language: 'python', code: 'try:\n\t$1\nexcept ${2:Exception} as ${3:e}:\n\tprint(${3:e})$0' },
  { name: 'Python for loop', prefix: 'for', description: 'for loop over an iterable', category: 'Python', language: 'python', code: 'for ${1:item} in ${2:iterable}:\n\t$0' },
  { name: 'Python while loop', prefix: 'while', description: 'while loop', category: 'Python', language: 'python', code: 'while ${1:condition}:\n\t$0' },
  { name: 'Python list comprehension', prefix: 'listcomp', description: 'List comprehension expression', category: 'Python', language: 'python', code: '[${1:expr} for ${2:x} in ${3:iterable}]$0' },
  { name: 'Python lambda', prefix: 'lambda', description: 'Lambda (anonymous) function', category: 'Python', language: 'python', code: 'lambda ${1:args}: ${2:expr}$0' },
  { name: 'Python print', prefix: 'print', description: 'print() call', category: 'Python', language: 'python', code: 'print(${1:value})$0' },
  { name: 'Python int input', prefix: 'inputint', description: 'Read an integer from stdin input', category: 'Python', language: 'python', code: '${1:n} = int(input(${2:"Enter a number: "}))$0' },
  { name: 'Python fast input', prefix: 'fastio', description: 'Fast stdin read-all-and-split competitive programming pattern', category: 'Python', language: 'python', code: 'import sys\n\ndata = sys.stdin.read().strip().split()\n${1:it} = iter(data)\n$0' },

  // ── C++ ────────────────────────────────────────────────────────────────────
  { name: 'C++ main with fast I/O', prefix: 'main', description: 'bits/stdc++.h include, fast I/O setup and main', category: 'C++', language: 'cpp', code: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n\tios::sync_with_stdio(false);\n\tcin.tie(nullptr);\n\t$0\n\treturn 0;\n}' },
  { name: 'C++ competitive programming template', prefix: 'cpptemplate', description: 'CP template with solve() and multiple test cases', category: 'C++', language: 'cpp', code: '#include <bits/stdc++.h>\nusing namespace std;\n\nvoid solve() {\n\t$0\n}\n\nint main() {\n\tios::sync_with_stdio(false);\n\tcin.tie(nullptr);\n\tint t;\n\tcin >> t;\n\twhile (t--) solve();\n\treturn 0;\n}' },
  { name: 'C++ for loop', prefix: 'fori', description: 'Classic indexed for loop', category: 'C++', language: 'cpp', code: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}' },
  { name: 'C++ range-based for loop', prefix: 'forr', description: 'Range-based for loop', category: 'C++', language: 'cpp', code: 'for (${1:auto} ${2:x} : ${3:container}) {\n\t$0\n}' },
  { name: 'C++ vector declaration', prefix: 'vec', description: 'std::vector declaration with size', category: 'C++', language: 'cpp', code: 'vector<${1:int}> ${2:v}(${3:n});$0' },
  { name: 'C++ class', prefix: 'class', description: 'Class with public constructor', category: 'C++', language: 'cpp', code: 'class ${1:Name} {\npublic:\n\t${1:Name}(${2:args});\n\t$0\n};' },
  { name: 'C++ struct', prefix: 'struct', description: 'Struct definition', category: 'C++', language: 'cpp', code: 'struct ${1:Name} {\n\t${2:int x};\n\t$0\n};' },
  { name: 'C++ cout', prefix: 'cout', description: 'cout print statement', category: 'C++', language: 'cpp', code: 'cout << ${1:value} << endl;$0' },
  { name: 'C++ cin', prefix: 'cin', description: 'cin input statement', category: 'C++', language: 'cpp', code: 'cin >> ${1:x};$0' },

  // ── Java ───────────────────────────────────────────────────────────────────
  { name: 'Java main class', prefix: 'main', description: 'Public class with a main method', category: 'Java', language: 'java', code: 'public class ${1:Main} {\n\tpublic static void main(String[] args) {\n\t\t$0\n\t}\n}' },
  { name: 'Java class', prefix: 'class', description: 'Public class skeleton', category: 'Java', language: 'java', code: 'public class ${1:Name} {\n\t$0\n}' },
  { name: 'Java System.out.println', prefix: 'sout', description: 'System.out.println statement', category: 'Java', language: 'java', code: 'System.out.println(${1:value});$0' },
  { name: 'Java for loop', prefix: 'fori', description: 'Classic indexed for loop', category: 'Java', language: 'java', code: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}' },
  { name: 'Java try/catch', prefix: 'trycatch', description: 'try/catch block printing the stack trace', category: 'Java', language: 'java', code: 'try {\n\t$1\n} catch (${2:Exception} ${3:e}) {\n\t${3:e}.printStackTrace();$0\n}' },
  { name: 'Java Scanner input', prefix: 'scanner', description: 'Scanner declaration reading an int from stdin', category: 'Java', language: 'java', code: 'Scanner ${1:sc} = new Scanner(System.in);\n${2:int n} = ${1:sc}.nextInt();$0' },
  { name: 'Java ArrayList', prefix: 'arraylist', description: 'ArrayList declaration with generics', category: 'Java', language: 'java', code: 'ArrayList<${1:String}> ${2:list} = new ArrayList<>();$0' },
];
