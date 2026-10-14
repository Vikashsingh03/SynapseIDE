// Practice Arena problem bank.
// Each problem has exact I/O formats; tests judge the CURRENT content of the
// linked editor file through the same /execute (JDoodle) pipeline as Run.
export const PRACTICE_PROBLEMS = [
  {
    id: 'p01',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    tags: ['arrays', 'hashing'],
    statement:
      'Given an array of n distinct integers and a target value, find the two numbers that add up to the target. There is exactly one such pair.\n\n' +
      'Input format:\nLine 1: integer n\nLine 2: n space-separated integers\nLine 3: integer target\n\n' +
      'Output format:\nPrint "i j" — the 0-based indices of the two numbers with i < j, separated by a single space.',
    examples: [
      {
        input: '4\n2 7 11 15\n9',
        output: '0 1',
        explanation: 'arr[0] + arr[1] = 2 + 7 = 9',
      },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip().split()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data[0])\n' +
        '    arr = list(map(int, data[1:1 + n]))\n' +
        '    target = int(data[1 + n])\n' +
        '    # TODO: find i < j with arr[i] + arr[j] == target\n' +
        '    # then print the indices separated by a space, e.g. print(str(i) + " " + str(j))\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const data = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\n" +
        'const n = data[0];\n' +
        'const arr = data.slice(1, 1 + n);\n' +
        'const target = data[1 + n];\n' +
        '// TODO: find i < j with arr[i] + arr[j] == target\n' +
        '// then print the indices separated by a space, e.g. console.log(i + " " + j);\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    vector<long long> a(n);\n' +
        '    for (int i = 0; i < n; i++) cin >> a[i];\n' +
        '    long long target;\n' +
        '    cin >> target;\n' +
        '    // TODO: find i < j with a[i] + a[j] == target and print "i j"\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        long[] a = new long[n];\n' +
        '        for (int i = 0; i < n; i++) a[i] = sc.nextLong();\n' +
        '        long target = sc.nextLong();\n' +
        '        // TODO: find i < j with a[i] + a[j] == target and print i + " " + j\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '4\n2 7 11 15\n9', output: '0 1' },
      { input: '3\n-1 -2 -3\n-5', output: '1 2' },
      { input: '5\n3 2 4 1 5\n6', output: '1 2' },
      { input: '2\n0 0\n0', output: '0 1' },
    ],
  },
  {
    id: 'p02',
    slug: 'reverse-string',
    title: 'Reverse a String',
    difficulty: 'Easy',
    tags: ['strings'],
    statement:
      'Given a single word (lowercase letters, no spaces), print it reversed.\n\n' +
      'Input format:\nLine 1: the string s\n\n' +
      'Output format:\nPrint s reversed.',
    examples: [
      { input: 'hello', output: 'olleh' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    s = sys.stdin.read().strip()\n' +
        '    # TODO: print the string reversed\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const s = fs.readFileSync(0, 'utf-8').trim();\n" +
        '// TODO: print the string reversed\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    string s;\n' +
        '    if (!(cin >> s)) return 0;\n' +
        '    // TODO: print the string reversed\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        String s = sc.next();\n' +
        '        // TODO: print the string reversed\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: 'hello', output: 'olleh' },
      { input: 'a', output: 'a' },
      { input: 'abcd', output: 'dcba' },
      { input: 'racecar', output: 'racecar' },
    ],
  },
  {
    id: 'p03',
    slug: 'palindrome-check',
    title: 'Palindrome Check',
    difficulty: 'Easy',
    tags: ['strings', 'two-pointers'],
    statement:
      'Given a single word (lowercase letters, no spaces), check whether it reads the same forwards and backwards.\n\n' +
      'Input format:\nLine 1: the string s\n\n' +
      'Output format:\nPrint YES if s is a palindrome, otherwise print NO.',
    examples: [
      { input: 'madam', output: 'YES', explanation: 'madam reversed is madam' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    s = sys.stdin.read().strip()\n' +
        '    # TODO: print YES if s is a palindrome, else NO\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const s = fs.readFileSync(0, 'utf-8').trim();\n" +
        '// TODO: print YES if s is a palindrome, else NO\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    string s;\n' +
        '    if (!(cin >> s)) return 0;\n' +
        '    // TODO: print YES if s is a palindrome, else NO\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        String s = sc.next();\n' +
        '        // TODO: print YES if s is a palindrome, else NO\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: 'madam', output: 'YES' },
      { input: 'hello', output: 'NO' },
      { input: 'a', output: 'YES' },
      { input: 'abba', output: 'YES' },
    ],
  },
  {
    id: 'p04',
    slug: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'Easy',
    tags: ['loops', 'math'],
    statement:
      'Given an integer n, print the numbers from 1 to n, one per line. For multiples of 3 print "Fizz" instead of the number, for multiples of 5 print "Buzz", and for multiples of both 3 and 5 print "FizzBuzz".\n\n' +
      'Input format:\nLine 1: integer n (1 <= n <= 100)\n\n' +
      'Output format:\nPrint n lines as described.',
    examples: [
      { input: '5', output: '1\n2\nFizz\n4\nBuzz' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data)\n' +
        '    # TODO: for i in 1..n print Fizz/Buzz/FizzBuzz or the number, one per line\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const n = parseInt(fs.readFileSync(0, 'utf-8').trim(), 10);\n" +
        '// TODO: for i in 1..n print Fizz/Buzz/FizzBuzz or the number, one per line\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    // TODO: for i in 1..n print Fizz/Buzz/FizzBuzz or the number, one per line\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        // TODO: for i in 1..n print Fizz/Buzz/FizzBuzz or the number, one per line\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '5', output: '1\n2\nFizz\n4\nBuzz' },
      { input: '1', output: '1' },
      { input: '15', output: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz' },
    ],
  },
  {
    id: 'p05',
    slug: 'max-element',
    title: 'Maximum Element',
    difficulty: 'Easy',
    tags: ['arrays'],
    statement:
      'Given an array of n integers, find the maximum element.\n\n' +
      'Input format:\nLine 1: integer n\nLine 2: n space-separated integers\n\n' +
      'Output format:\nPrint the maximum value.',
    examples: [
      { input: '5\n1 5 3 9 2', output: '9' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip().split()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data[0])\n' +
        '    arr = list(map(int, data[1:1 + n]))\n' +
        '    # TODO: print the maximum element of arr\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const data = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\n" +
        'const n = data[0];\n' +
        'const arr = data.slice(1, 1 + n);\n' +
        '// TODO: print the maximum element of arr\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    vector<long long> a(n);\n' +
        '    for (int i = 0; i < n; i++) cin >> a[i];\n' +
        '    // TODO: print the maximum element of a\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        long best = Long.MIN_VALUE;\n' +
        '        for (int i = 0; i < n; i++) best = Math.max(best, sc.nextLong());\n' +
        '        // TODO: print the maximum value (hint: it is already in best)\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '5\n1 5 3 9 2', output: '9' },
      { input: '1\n-7', output: '-7' },
      { input: '4\n-3 -8 -1 -5', output: '-1' },
    ],
  },
  {
    id: 'p06',
    slug: 'second-largest',
    title: 'Second Largest',
    difficulty: 'Medium',
    tags: ['arrays'],
    statement:
      'Given an array of n DISTINCT integers (n >= 2), find the second largest element.\n\n' +
      'Input format:\nLine 1: integer n\nLine 2: n space-separated distinct integers\n\n' +
      'Output format:\nPrint the second largest value.',
    examples: [
      { input: '5\n1 5 3 9 2', output: '5', explanation: 'Largest is 9, second largest is 5' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip().split()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data[0])\n' +
        '    arr = list(map(int, data[1:1 + n]))\n' +
        '    # TODO: print the second largest element of arr (all values are distinct)\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const data = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\n" +
        'const n = data[0];\n' +
        'const arr = data.slice(1, 1 + n);\n' +
        '// TODO: print the second largest element of arr (all values are distinct)\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    vector<long long> a(n);\n' +
        '    for (int i = 0; i < n; i++) cin >> a[i];\n' +
        '    // TODO: print the second largest element of a (all values are distinct)\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        long[] a = new long[n];\n' +
        '        for (int i = 0; i < n; i++) a[i] = sc.nextLong();\n' +
        '        // TODO: print the second largest element of a (all values are distinct)\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '5\n1 5 3 9 2', output: '5' },
      { input: '2\n10 20', output: '10' },
      { input: '8\n8 3 7 1 9 2 6 4', output: '8' },
    ],
  },
  {
    id: 'p07',
    slug: 'count-vowels',
    title: 'Count Vowels',
    difficulty: 'Easy',
    tags: ['strings'],
    statement:
      'Given a single word (lowercase letters, no spaces), count how many of its letters are vowels (a, e, i, o, u).\n\n' +
      'Input format:\nLine 1: the string s\n\n' +
      'Output format:\nPrint the vowel count.',
    examples: [
      { input: 'hello', output: '2', explanation: 'e and o are vowels' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    s = sys.stdin.read().strip()\n' +
        '    # TODO: print the number of vowels (a, e, i, o, u) in s\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const s = fs.readFileSync(0, 'utf-8').trim();\n" +
        '// TODO: print the number of vowels (a, e, i, o, u) in s\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    string s;\n' +
        '    if (!(cin >> s)) return 0;\n' +
        '    // TODO: print the number of vowels (a, e, i, o, u) in s\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        String s = sc.next();\n' +
        '        // TODO: print the number of vowels (a, e, i, o, u) in s\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: 'hello', output: '2' },
      { input: 'xyz', output: '0' },
      { input: 'aeiou', output: '5' },
      { input: 'rhythm', output: '0' },
    ],
  },
  {
    id: 'p08',
    slug: 'fibonacci-nth',
    title: 'Nth Fibonacci Number',
    difficulty: 'Medium',
    tags: ['math', 'dp'],
    statement:
      'The Fibonacci sequence starts 0, 1, 1, 2, 3, 5, 8, ... where each number is the sum of the two before it. Note: the sequence is 0-indexed, so fib(0) = 0 and fib(1) = 1.\n\n' +
      'Input format:\nLine 1: integer n (0 <= n <= 40)\n\n' +
      'Output format:\nPrint fib(n).',
    examples: [
      { input: '10', output: '55' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data)\n' +
        '    # TODO: print the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1)\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const n = parseInt(fs.readFileSync(0, 'utf-8').trim(), 10);\n" +
        '// TODO: print the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1)\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    // TODO: print the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1)\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        // TODO: print the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1)\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '0', output: '0' },
      { input: '1', output: '1' },
      { input: '10', output: '55' },
      { input: '20', output: '6765' },
      { input: '30', output: '832040' },
    ],
  },
  {
    id: 'p09',
    slug: 'prime-check',
    title: 'Prime Check',
    difficulty: 'Easy',
    tags: ['math'],
    statement:
      'Given an integer n, check whether it is a prime number. (1 and negative numbers are not prime.)\n\n' +
      'Input format:\nLine 1: integer n\n\n' +
      'Output format:\nPrint YES if n is prime, otherwise print NO.',
    examples: [
      { input: '7', output: 'YES' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data)\n' +
        '    # TODO: print YES if n is prime, else NO\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const n = parseInt(fs.readFileSync(0, 'utf-8').trim(), 10);\n" +
        '// TODO: print YES if n is prime, else NO\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    long long n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    // TODO: print YES if n is prime, else NO\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        long n = sc.nextLong();\n' +
        '        // TODO: print YES if n is prime, else NO\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '7', output: 'YES' },
      { input: '10', output: 'NO' },
      { input: '2', output: 'YES' },
      { input: '1', output: 'NO' },
      { input: '97', output: 'YES' },
    ],
  },
  {
    id: 'p10',
    slug: 'anagram-check',
    title: 'Anagram Check',
    difficulty: 'Easy',
    tags: ['strings', 'sorting'],
    statement:
      'Given two words (lowercase letters, no spaces), check whether they are anagrams of each other (same letters in a different order).\n\n' +
      'Input format:\nLine 1: first word\nLine 2: second word\n\n' +
      'Output format:\nPrint YES if they are anagrams, otherwise print NO.',
    examples: [
      { input: 'listen\nsilent', output: 'YES', explanation: 'same letters, different order' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    lines = sys.stdin.read().strip().splitlines()\n' +
        '    if len(lines) < 2:\n' +
        '        return\n' +
        '    a, b = lines[0].strip(), lines[1].strip()\n' +
        '    # TODO: print YES if a and b are anagrams, else NO\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n" +
        'const a = (lines[0] || "").trim();\n' +
        'const b = (lines[1] || "").trim();\n' +
        '// TODO: print YES if a and b are anagrams, else NO\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    string a, b;\n' +
        '    if (!(cin >> a)) return 0;\n' +
        '    if (!(cin >> b)) return 0;\n' +
        '    // TODO: print YES if a and b are anagrams, else NO\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        String a = sc.next();\n' +
        '        String b = sc.next();\n' +
        '        // TODO: print YES if a and b are anagrams, else NO\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: 'listen\nsilent', output: 'YES' },
      { input: 'hello\nworld', output: 'NO' },
      { input: 'abc\ncba', output: 'YES' },
      { input: 'a\naa', output: 'NO' },
    ],
  },
  {
    id: 'p11',
    slug: 'kadane-max-subarray',
    title: 'Maximum Subarray Sum',
    difficulty: 'Medium',
    tags: ['arrays', 'dp'],
    statement:
      "Given an array of n integers (they may be negative), find the maximum sum of any non-empty contiguous subarray.\n\n" +
      'Input format:\nLine 1: integer n\nLine 2: n space-separated integers\n\n' +
      'Output format:\nPrint the maximum subarray sum.',
    examples: [
      {
        input: '-2 1 -3 4 -1 2 1 -5 3',
        output: '6',
        explanation: 'With n = 8, the subarray [4, -1, 2, 1] sums to 6',
      },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip().split()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data[0])\n' +
        '    arr = list(map(int, data[1:1 + n]))\n' +
        '    # TODO: print the maximum sum of any non-empty contiguous subarray\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const data = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\n" +
        'const n = data[0];\n' +
        'const arr = data.slice(1, 1 + n);\n' +
        '// TODO: print the maximum sum of any non-empty contiguous subarray\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    vector<long long> a(n);\n' +
        '    for (int i = 0; i < n; i++) cin >> a[i];\n' +
        '    // TODO: print the maximum sum of any non-empty contiguous subarray\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        long[] a = new long[n];\n' +
        '        for (int i = 0; i < n; i++) a[i] = sc.nextLong();\n' +
        '        // TODO: print the maximum sum of any non-empty contiguous subarray\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '8\n-2 1 -3 4 -1 2 1 -5 3', output: '6' },
      { input: '3\n-5 -2 -8', output: '-2' },
      { input: '5\n1 2 3 4 5', output: '15' },
      { input: '4\n-1 -2 3 -4', output: '3' },
    ],
  },
  {
    id: 'p12',
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Medium',
    tags: ['arrays', 'search'],
    statement:
      'Given a sorted array of n integers (ascending) and a target value x, find the 0-based index of x in the array using binary search. If x is not present, print -1.\n\n' +
      'Input format:\nLine 1: integer n\nLine 2: n space-separated integers in ascending order\nLine 3: integer x\n\n' +
      'Output format:\nPrint the index of x, or -1 if x is not in the array.',
    examples: [
      { input: '5\n1 2 3 4 5\n3', output: '2' },
    ],
    starter: {
      python:
        'import sys\n\n' +
        'def solve():\n' +
        '    data = sys.stdin.read().strip().split()\n' +
        '    if not data:\n' +
        '        return\n' +
        '    n = int(data[0])\n' +
        '    arr = list(map(int, data[1:1 + n]))\n' +
        '    x = int(data[1 + n])\n' +
        '    # TODO: binary search x in the sorted arr, print its index or -1\n' +
        '    pass\n\n' +
        'if __name__ == "__main__":\n' +
        '    solve()\n',
      javascript:
        "const fs = require('fs');\n" +
        "const data = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\n" +
        'const n = data[0];\n' +
        'const arr = data.slice(1, 1 + n);\n' +
        'const x = data[1 + n];\n' +
        '// TODO: binary search x in the sorted arr, print its index or -1\n',
      cpp:
        '#include <bits/stdc++.h>\n' +
        'using namespace std;\n' +
        'int main() {\n' +
        '    ios::sync_with_stdio(false);\n' +
        '    cin.tie(nullptr);\n' +
        '    int n;\n' +
        '    if (!(cin >> n)) return 0;\n' +
        '    vector<long long> a(n);\n' +
        '    for (int i = 0; i < n; i++) cin >> a[i];\n' +
        '    long long x;\n' +
        '    cin >> x;\n' +
        '    // TODO: binary search x in the sorted a, print its index or -1\n' +
        '    return 0;\n' +
        '}\n',
      java:
        'import java.util.*;\n' +
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        Scanner sc = new Scanner(System.in);\n' +
        '        int n = sc.nextInt();\n' +
        '        long[] a = new long[n];\n' +
        '        for (int i = 0; i < n; i++) a[i] = sc.nextLong();\n' +
        '        long x = sc.nextLong();\n' +
        '        // TODO: binary search x in the sorted a, print its index or -1\n' +
        '    }\n' +
        '}\n',
    },
    tests: [
      { input: '5\n1 2 3 4 5\n3', output: '2' },
      { input: '5\n1 2 3 4 5\n6', output: '-1' },
      { input: '1\n42\n42', output: '0' },
      { input: '6\n-5 -2 0 7 9 11\n-5', output: '0' },
      { input: '4\n10 20 30 40\n25', output: '-1' },
    ],
  },
];

export const PRACTICE_LANGUAGES = [
  { id: 71, name: 'Python', ext: 'py', key: 'python' },
  { id: 63, name: 'JavaScript', ext: 'js', key: 'javascript' },
  { id: 54, name: 'C++', ext: 'cpp', key: 'cpp' },
  { id: 62, name: 'Java', ext: 'java', key: 'java' },
];
