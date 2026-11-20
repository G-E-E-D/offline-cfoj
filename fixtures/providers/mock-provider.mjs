#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (process.env.CFOJ_TEST_ARGV_FILE) fs.writeFileSync(process.env.CFOJ_TEST_ARGV_FILE, JSON.stringify(args));
const mode = args[0] || 'codex'; // 'codex' or 'agy'

if (args.includes('--version') || args.includes('-v')) {
  const failMode = process.env.CFOJ_MOCK_PROVIDER_FAIL || '';
  if (failMode === 'version_error') {
    process.stderr.write('Error: unsupported CLI version 0.0.1-broken\n');
    process.exit(2);
  }
  if (mode === 'codex') {
    process.stdout.write('codex-cli 0.114.0 (Offline CFOJ repeatable fixture adapter)\n');
  } else {
    process.stdout.write('Google Antigravity CLI (agy) 2.4.0 (Offline CFOJ repeatable fixture adapter)\n');
  }
  process.exit(0);
}

const failMode = process.env.CFOJ_MOCK_PROVIDER_FAIL || '';
if (failMode === 'auth_error') {
  process.stderr.write(
    mode === 'codex'
      ? 'Error: Not authenticated with OpenAI Codex. Run `codex login` to sign in.\n'
      : 'Error: Authentication required for Google Antigravity headless mode (`agy`). Sign in interactively first.\n'
  );
  process.exit(1);
}

if (failMode === 'version_error') {
  process.stderr.write(`Error: unrecognized flag in ${mode} CLI (version mismatch)\n`);
  process.exit(2);
}

// Parse CLI flags for codex exec vs agy -p
let outputLastMessagePath = null;
let schemaPath = null;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--output-last-message' || args[i] === '-o') && args[i + 1]) {
    outputLastMessagePath = args[i + 1];
    i++;
  } else if ((args[i] === '--output-schema' || args[i] === '--json-schema') && args[i + 1]) {
    schemaPath = args[i + 1];
    i++;
  }
}

// Read stdin prompt
let stdinText = '';
try {
  stdinText = fs.readFileSync(0, 'utf8');
} catch {
  stdinText = '';
}

const materialsPath = path.join(process.cwd(), 'problem-materials.json');
if (!fs.existsSync(materialsPath)) {
  process.stderr.write('Error: problem-materials.json not found in isolated working directory\n');
  process.exit(1);
}
const materials = JSON.parse(fs.readFileSync(materialsPath, 'utf8'));

if (failMode === 'malformed_json') {
  const broken = '{"broken_json": true, ';
  if (mode === 'codex' && outputLastMessagePath) {
    fs.writeFileSync(outputLastMessagePath, broken, 'utf8');
  } else {
    process.stdout.write(broken);
  }
  process.exit(0);
}

const providerLabel = mode === 'codex' ? 'OpenAI Codex' : 'Google Antigravity';

function buildTranslationResponse(mat) {
  const idx = String(mat.problemIndex || 'A').toUpperCase();
  const stmt = mat.statement || {};
  const corrupt = failMode === 'corrupt_fragments';

  const translations = {
    A: {
      title: '西瓜',
      descriptionHtml: corrupt
        ? '<p>炎热的夏日，Pete 和他的朋友 Billy 决定买一个西瓜。称重结果显示西瓜重 w 千克。他们希望把西瓜分成两部分，每部分的重量都是偶数千克，并且每部分重量都大于零。</p>'
        : `<p>炎热的夏日，Pete 和他的朋友 Billy 决定买一个西瓜。他们挑选了自认为最大最熟的一个。随后对西瓜进行称重，秤上显示为 $$$w$$$ 千克。他们口渴难耐地赶回家，准备分吃这个西瓜，却遇到了一个难题。</p>
<p>Pete 和 Billy 非常喜欢偶数，因此他们希望把西瓜分成两部分，使得每一部分的重量都是偶数千克（两部分不必相等）。男孩们已经非常疲倦，想尽快开始享用西瓜，请你帮他们判断能否按要求分好西瓜。当然，每个人分到的部分重量都必须是正数。</p>
<center>
  <img class="tex-graphics" src="/api/contests/${mat.contestId || 4}/assets/4a-watermelon.svg" alt="Watermelon division diagram">
</center>
<table class="tex-tabular">
  <thead>
    <tr><th>总重量 $$$w$$$</th><th>合法的偶数划分 $$$a + b = w$$$</th><th>期望输出</th></tr>
  </thead>
  <tbody>
    <tr><td>$$$2$$$</td><td>仅有 $$$1 + 1$$$（均为奇数）</td><td><code>NO</code></td></tr>
    <tr><td>$$$8$$$</td><td>$$$2 + 6$$$ 或 $$$4 + 4$$$</td><td><code>YES</code></td></tr>
  </tbody>
</table>`,
      inputSpecHtml: corrupt
        ? '<p>输入仅一行，包含一个整数 w（1 到 100）——男孩们购买的西瓜重量。</p>'
        : '<p>第一行（也是唯一一行）输入包含一个整数 $$$w$$$ ($$$1 \\le w \\le 100$$$) —— 男孩们购买的西瓜重量。</p>',
      outputSpecHtml: corrupt
        ? '<p>如果可以按要求分成两个偶数重量的部分，输出 是，否则输出 否。</p>'
        : '<p>如果男孩们能将西瓜分成两个重量均为偶数千克的部分，输出 <code>YES</code>；否则输出 <code>NO</code>。</p>',
      noteHtml:
        '<p>例如，男孩们可以将西瓜分成 2 千克和 6 千克两部分（另一种方案是分成 4 千克和 4 千克两部分）。</p>'
    },
    B: {
      title: '考前准备',
      descriptionHtml: `<p>明天 Peter 有一场生物考试。他并不怎么喜欢这门课，但在 $$$d$$$ 天前他就得知必须参加这场考试。Peter 严厉的父母要求他立即开始复习，规定他在第 $$$i$$$ 天学习的时间不少于 $$$minTime_i$$$ 小时且不超过 $$$maxTime_i$$$ 小时。此外，父母提醒他在考试前一天会检查他是否遵守了规定。</p>
<p>今天正是 Peter 的父母要求查看他复习时间表的日子。然而男孩只记录了复习总共花费的小时数 $$$sumTime$$$，现在他想知道能否向父母展示一份包含 $$$d$$$ 个数字的时间表 $$$s\\_schedule$$$，其中第 $$$i$$$ 个数 $$$s_i$$$ 表示 Peter 在第 $$$i$$$ 天复习生物的小时数，既满足父母规定的上下界限制，又使得所有 $$$s_i$$$ 的总和恰好等于 $$$sumTime$$$。</p>`,
      inputSpecHtml:
        '<p>输入第一行包含两个整数 $$$d$$$, $$$sumTime$$$ ($$$1 \\le d \\le 30, 0 \\le sumTime \\le 240$$$) —— Peter 复习的天数以及复习所花费的总小时数。接下来 $$$d$$$ 行，每行包含两个由空格分隔的整数 $$$minTime_i$$$, $$$maxTime_i$$$ ($$$0 \\le minTime_i \\le maxTime_i \\le 8$$$) —— Peter 在第 $$$i$$$ 天最少和最多可以学习的小时数。</p>',
      outputSpecHtml:
        '<p>如果存在合法方案，第一行输出 <code>YES</code>，第二行输出 $$$d$$$ 个由空格分隔的整数，依次表示 Peter 在每一天复习所花费的小时数；如果不存在合法方案，则在唯一一行输出 <code>NO</code>。如果存在多种合法方案，输出任意一种即可。</p>',
      noteHtml: ''
    },
    C: {
      title: '注册系统',
      descriptionHtml: `<p>全新的电子邮件服务“Berlandesk”即将在 Berland 上线。网站管理员希望尽快启动项目，因此请你帮忙实现网站注册系统的原型。该系统按如下规则工作：</p>
<p>每当新用户想要注册时，他会向系统发送一个包含用户名请求的申请。如果该用户名在系统数据库中尚不存在，则将其插入数据库，并向用户返回 <code>OK</code> 以确认注册成功。如果该用户名已存在于数据库中，系统会生成一个新的用户名作为提示返回给用户，并同时将该新用户名插入数据库。新用户名的生成规则如下：从 1 开始依次将数字拼接到原用户名之后（<code>name1</code>, <code>name2</code>, ...），找出最小的 $$$i$$$ 使得 <code>name</code>$$$i$$$ 尚未出现在数据库中。</p>`,
      inputSpecHtml:
        '<p>第一行包含一个整数 $$$n$$$ ($$$1 \\le n \\le 10^5$$$)。接下来 $$$n$$$ 行包含向系统发出的请求。每个请求都是非空行，由不超过 32 个小写拉丁字母组成。</p>',
      outputSpecHtml:
        '<p>输出 $$$n$$$ 行，表示系统对每次请求的响应：注册成功时输出 <code>OK</code>；若请求的用户名已被占用，则输出系统提示的新用户名。</p>',
      noteHtml: ''
    },
    D: {
      title: '神秘礼物',
      descriptionHtml: `<p>Peter 决定向远在澳大利亚的朋友祝贺生日并寄去一张贺卡。为了让礼物更加神秘，他决定制作一条<i>信封链</i>。这里的信封链是指一列信封 $$$A = \\{a_1, a_2, \\dots, a_k\\}$$$，其中第 $$$i$$$ 个信封的宽度和高度分别严格大于第 $$$(i - 1)$$$ 个信封的宽度和高度。信封链的长度即为链中信封的个数。</p>
<p>Peter 希望用他手头的信封制作出长度最大的信封链，并且能够把贺卡装进这条信封链中。当且仅当贺卡的宽度和高度分别严格小于信封链中最小信封的宽度和高度时，贺卡才能装入。禁止旋转贺卡或信封。Peter 有很多信封但时间紧迫，这个艰巨的任务就交给你了。</p>
<center>
  <img class="tex-graphics" src="/api/contests/${mat.contestId || 4}/assets/4d-envelopes.svg" alt="Nested envelopes chain diagram">
</center>`,
      inputSpecHtml:
        '<p>第一行包含三个整数 $$$n$$$, $$$w$$$, $$$h$$$ ($$$1 \\le n \\le 5000$$$, $$$1 \\le w, h \\le 10^6$$$) —— Peter 拥有的信封数量，以及贺卡的宽度和高度。接下来 $$$n$$$ 行，每行包含两个整数 $$$w_i$$$ 和 $$$h_i$$$ —— 第 $$$i$$$ 个信封的宽度和高度 ($$$1 \\le w_i, h_i \\le 10^6$$$)。</p>',
      outputSpecHtml:
        '<p>第一行输出最大信封链的长度。第二行输出构成该信封链的信封编号（以空格分隔），从最小信封的编号开始依次输出。请记住，贺卡必须能够装入最小的信封中。如果存在多组最大长度的方案，输出任意一组即可。如果贺卡无法装入任何信封中，则在唯一一行输出数字 <code>0</code>。</p>',
      noteHtml: ''
    }
  };

  const chosen = Number(mat.contestId) === 4 && translations[idx];
  if (!chosen) {
    process.stderr.write('The demo translator only contains translations for contest 4. Select a real AI CLI in Settings.\n');
    process.exit(1);
  }

  return {
    title: chosen.title,
    descriptionHtml: chosen.descriptionHtml,
    inputSpecHtml: chosen.inputSpecHtml,
    outputSpecHtml: chosen.outputSpecHtml,
    noteHtml: chosen.noteHtml,
    samples: stmt.samples || []
  };
}

function buildTestSuiteResponse(mat) {
  const idx = String(mat.problemIndex || 'A').toUpperCase();
  const disagree = failMode === 'oracle_disagreement';
  const isContest4 = Number(mat.contestId || 4) === 4;

  if (!isContest4) {
    const samples = mat.statement?.samples?.length ? mat.statement.samples : [{ input: '1\n', output: '1\n' }];
    const cppPairs = samples
      .map(
        (s) =>
          `{${JSON.stringify(String(s.input || '').replace(/\r\n/g, '\n').trimEnd())}, ${JSON.stringify(String(s.output || '').replace(/\r\n/g, '\n').trimEnd())}}`
      )
      .join(',\n        ');
    const solverCpp = `#include <bits/stdc++.h>
int main() {
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    std::string in = ss.str();
    std::string norm;
    for (char c : in) if (c != '\\r') norm.push_back(c);
    while (!norm.empty() && (norm.back() == '\\n' || norm.back() == ' ')) norm.pop_back();
    const std::vector<std::pair<std::string, std::string>> samples = {
        ${cppPairs}
    };
    for (const auto& [sin, sout] : samples) {
        std::string s = sin;
        while (!s.empty() && (s.back() == '\\n' || s.back() == ' ')) s.pop_back();
        if (norm == s) {
            std::cout << sout << "\\n";
            return 0;
        }
    }
    std::cout << norm << "\\n";
    return 0;
}`;
    const seeds = [];
    for (let i = 1; i <= 55; i++) {
      seeds.push({
        seed: i,
        category: i === 1 ? 'minimum' : i === 2 ? 'maximum' : i <= 10 ? 'boundary' : 'special_structure'
      });
    }
    return {
      planSummary: `Deterministic test suite for ${mat.contestId}${idx} (${mat.title || idx}).`,
      checkerType: 'token',
      checkerEps: 1e-6,
      checkerCpp: '',
      checkerSelfTests: [],
      generatorCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    int seed = (argc > 1) ? std::atoi(argv[1]) : 1;
    std::println("{}", 100000 + seed);
    return 0;
}`,
      validatorCpp: `#include <bits/stdc++.h>
int main() {
    std::string tok;
    if (!(std::cin >> tok)) return 1;
    return 0;
}`,
      referenceCpp: solverCpp,
      oracleCpp: solverCpp,
      wrongSolutions: [
        {
          name: 'wrong_constant_output',
          expectedVerdict: 'WA',
          sourceCpp: `#include <bits/stdc++.h>
int main() {
    std::println("__WRONG_ANSWER_SENTINEL__");
}`
        }
      ],
      seeds
    };
  }

  if (idx === 'A') {
    const seeds = [];
    for (let w = 1; w <= 100; w++) {
      let category = 'exhaustive';
      if (w === 1) category = 'minimum';
      else if (w === 100) category = 'maximum';
      else if (w === 2) category = 'anti_greedy_plausible_wrong';
      else if (w === 3 || w === 4 || w === 99) category = 'boundary';
      seeds.push({ seed: w, category });
    }
    return {
      planSummary: 'Exhaustive finite-domain test suite for w in [1, 100] covering minimum (1), maximum (100), parity trap (2), and all odd/even boundaries.',
      checkerType: 'token',
      checkerEps: 1e-6,
      checkerCpp: '',
      checkerSelfTests: [],
      generatorCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    int seed = (argc > 1) ? std::atoi(argv[1]) : 4;
    int w = ((seed - 1) % 100 + 100) % 100 + 1;
    std::println("{}", w);
    return 0;
}`,
      validatorCpp: `#include <bits/stdc++.h>
int main() {
    long long w;
    if (!(std::cin >> w)) return 1;
    if (w < 1 || w > 100) return 2;
    std::string extra;
    if (std::cin >> extra) return 3;
    return 0;
}`,
      referenceCpp: disagree
        ? `#include <bits/stdc++.h>
int main() {
    int w;
    std::cin >> w;
    // Intentional bug for oracle_disagreement test: claims w=2 is YES
    std::println("{}", (w % 2 == 0) ? "YES" : "NO");
}`
        : `#include <bits/stdc++.h>
int main() {
    int w;
    std::cin >> w;
    std::println("{}", (w % 2 == 0 && w > 2) ? "YES" : "NO");
}`,
      oracleCpp: `#include <bits/stdc++.h>
int main() {
    int w;
    std::cin >> w;
    bool ok = false;
    for (int a = 1; a < w; ++a) {
        int b = w - a;
        if (a % 2 == 0 && b % 2 == 0) ok = true;
    }
    std::println("{}", ok ? "YES" : "NO");
}`,
      wrongSolutions: [
        {
          name: 'parity_only_no_w2_check',
          expectedVerdict: 'WA',
          sourceCpp: `#include <bits/stdc++.h>
int main() {
    int w;
    std::cin >> w;
    std::println("{}", (w % 2 == 0) ? "YES" : "NO");
}`
        }
      ],
      seeds
    };
  }

  if (idx === 'B') {
    const seeds = [];
    for (let i = 1; i <= 55; i++) {
      let category = 'special_structure';
      if (i <= 5) category = 'minimum';
      else if (i <= 12) category = 'maximum';
      else if (i <= 22) category = 'boundary';
      else if (i <= 32) category = 'ties';
      else if (i <= 42) category = 'anti_greedy_plausible_wrong';
      else category = 'stress_max_complexity';
      seeds.push({ seed: i, category });
    }
    return {
      planSummary: '50+ distinct generated cases for 4B covering d=1..30, sumTime=0..240, exact L and R boundaries, L-1 and R+1 infeasible cases, multi-solution ties, and semantic checker validation.',
      checkerType: 'custom',
      checkerEps: 1e-6,
      checkerCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    if (argc < 4) return 3;
    std::ifstream fin(argv[1]);
    std::ifstream fout(argv[2]);
    std::ifstream fans(argv[3]);
    if (!fin || !fout) return 3;

    int d, sumTime;
    if (!(fin >> d >> sumTime)) return 3;
    std::vector<int> mn(d), mx(d);
    int sumMin = 0, sumMax = 0;
    for (int i = 0; i < d; ++i) {
        fin >> mn[i] >> mx[i];
        sumMin += mn[i];
        sumMax += mx[i];
    }
    bool feasible = (sumTime >= sumMin && sumTime <= sumMax);

    std::string verdict;
    if (!(fout >> verdict)) {
        std::println("Unexpected EOF in contestant output");
        return 1;
    }
    if (!feasible) {
        if (verdict != "NO") {
            std::println("Expected NO for infeasible sumTime={}, got {}", sumTime, verdict);
            return 1;
        }
        std::string extra;
        if (fout >> extra) {
            std::println("Trailing tokens after NO");
            return 1;
        }
        std::println("ok NO");
        return 0;
    }

    if (verdict != "YES") {
        std::println("Expected YES for feasible instance, got {}", verdict);
        return 1;
    }
    int total = 0;
    for (int i = 0; i < d; ++i) {
        int s;
        if (!(fout >> s)) {
            std::println("Missing schedule value for day {}", i + 1);
            return 1;
        }
        if (s < mn[i] || s > mx[i]) {
            std::println("Day {} hours {} outside [{}, {}]", i + 1, s, mn[i], mx[i]);
            return 1;
        }
        total += s;
    }
    std::string extra;
    if (fout >> extra) {
        std::println("Extra trailing token: {}", extra);
        return 1;
    }
    if (total != sumTime) {
        std::println("Schedule sum {} != required sumTime {}", total, sumTime);
        return 1;
    }
    std::println("ok valid schedule (sum={})", total);
    return 0;
}`,
      checkerSelfTests: [
        {
          input: '2 3\n1 2\n1 2\n',
          expectedOutput: 'YES\n2 1\n',
          candidateOutput: 'YES\n1 2\n',
          shouldAccept: true
        },
        {
          input: '2 3\n1 2\n1 2\n',
          expectedOutput: 'YES\n2 1\n',
          candidateOutput: 'YES\n2 1\n',
          shouldAccept: true
        },
        {
          input: '2 3\n1 2\n1 2\n',
          expectedOutput: 'YES\n2 1\n',
          candidateOutput: 'YES\n2 2\n',
          shouldAccept: false
        }
      ],
      generatorCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    int seed = (argc > 1) ? std::atoi(argv[1]) : 1;
    if (seed == 1) {
        // Prompt acceptance test case: 2 3 / 1 2 / 1 2
        std::println("2 3");
        std::println("1 2");
        std::println("1 2");
        return 0;
    }
    if (seed == 2) {
        std::println("1 0");
        std::println("0 0");
        return 0;
    }
    if (seed == 3) {
        std::println("30 240");
        for (int i = 0; i < 30; ++i) std::println("8 8");
        return 0;
    }
    std::mt19937 rng(seed * 10007U + 42U);
    int d = (seed <= 12) ? 30 : (1 + (seed % 30));
    std::vector<int> mn(d), mx(d);
    int sumMin = 0, sumMax = 0;
    for (int i = 0; i < d; ++i) {
        int a = rng() % 9;
        int b = rng() % 9;
        if (a > b) std::swap(a, b);
        mn[i] = a;
        mx[i] = b;
        sumMin += a;
        sumMax += b;
    }
    int sumTime = sumMin;
    if (seed % 5 == 0) {
        sumTime = std::max(0, sumMin - 1 - (seed % 3));
    } else if (seed % 5 == 1) {
        sumTime = std::min(240, sumMax + 1 + (seed % 3));
    } else if (seed % 5 == 2) {
        sumTime = sumMin;
    } else if (seed % 5 == 3) {
        sumTime = sumMax;
    } else {
        sumTime = sumMin + (sumMax > sumMin ? (rng() % (sumMax - sumMin + 1)) : 0);
    }
    std::println("{} {}", d, sumTime);
    for (int i = 0; i < d; ++i) {
        std::println("{} {}", mn[i], mx[i]);
    }
    return 0;
}`,
      validatorCpp: `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    if (!(std::cin >> d >> sumTime)) return 1;
    if (d < 1 || d > 30 || sumTime < 0 || sumTime > 240) return 2;
    for (int i = 0; i < d; ++i) {
        int l, r;
        if (!(std::cin >> l >> r)) return 3;
        if (l < 0 || l > r || r > 8) return 4;
    }
    std::string extra;
    if (std::cin >> extra) return 5;
    return 0;
}`,
      referenceCpp: `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    if (!(std::cin >> d >> sumTime)) return 0;
    std::vector<int> mn(d), mx(d);
    int sumMin = 0, sumMax = 0;
    for (int i = 0; i < d; ++i) {
        std::cin >> mn[i] >> mx[i];
        sumMin += mn[i];
        sumMax += mx[i];
    }
    if (sumTime < sumMin || sumTime > sumMax) {
        std::println("NO");
        return 0;
    }
    std::println("YES");
    int rem = sumTime - sumMin;
    for (int i = 0; i < d; ++i) {
        int add = std::min(rem, mx[i] - mn[i]);
        rem -= add;
        std::print("{}{}", mn[i] + add, (i + 1 == d) ? "\\n" : " ");
    }
    return 0;
}`,
      oracleCpp: `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    if (!(std::cin >> d >> sumTime)) return 0;
    std::vector<int> mn(d), mx(d);
    int sumMin = 0, sumMax = 0;
    for (int i = 0; i < d; ++i) {
        std::cin >> mn[i] >> mx[i];
        sumMin += mn[i];
        sumMax += mx[i];
    }
    if (sumTime < sumMin || sumTime > sumMax) {
        std::println("NO");
        return 0;
    }
    // Independent reverse-order distribution oracle
    std::vector<int> ans = mn;
    int rem = sumTime - sumMin;
    for (int i = d - 1; i >= 0; --i) {
        int add = std::min(rem, mx[i] - mn[i]);
        ans[i] += add;
        rem -= add;
    }
    std::println("YES");
    for (int i = 0; i < d; ++i) {
        std::print("{}{}", ans[i], (i + 1 == d) ? "\\n" : " ");
    }
    return 0;
}`,
      wrongSolutions: [
        {
          name: 'ignores_upper_bound_check',
          expectedVerdict: 'WA',
          sourceCpp: `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    std::cin >> d >> sumTime;
    std::vector<int> mn(d), mx(d);
    int sumMin = 0;
    for (int i = 0; i < d; ++i) {
        std::cin >> mn[i] >> mx[i];
        sumMin += mn[i];
    }
    if (sumTime < sumMin) { std::println("NO"); return 0; }
    std::println("YES");
    for (int i = 0; i < d; ++i) {
        int val = (i + 1 == d) ? (sumTime - (sumMin - mn[i])) : mn[i];
        std::print("{}{}", val, (i + 1 == d) ? "\\n" : " ");
    }
}`
        }
      ],
      seeds
    };
  }

  if (idx === 'C') {
    const seeds = [];
    for (let i = 1; i <= 55; i++) {
      let category = 'special_structure';
      if (i <= 5) category = 'minimum';
      else if (i <= 12) category = 'maximum';
      else if (i <= 22) category = 'boundary';
      else if (i <= 32) category = 'ties';
      else if (i <= 42) category = 'anti_greedy_plausible_wrong';
      else category = 'stress_max_complexity';
      seeds.push({ seed: i, category });
    }
    return {
      planSummary: '50+ distinct generated cases for 4C covering n=1, max length 32 lowercase strings, heavy hash collisions, repeated prefixes, and large inputs.',
      checkerType: 'token',
      checkerEps: 1e-6,
      checkerCpp: '',
      checkerSelfTests: [],
      generatorCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    int seed = (argc > 1) ? std::atoi(argv[1]) : 1;
    std::mt19937 rng(seed * 99991U + 17U);
    if (seed == 1) {
        std::println("1");
        std::println("a");
        return 0;
    }
    if (seed == 2) {
        std::println("5");
        for (int i = 0; i < 5; ++i) std::println("abcdefghijklmnopqrstuvwxyzabcdef");
        return 0;
    }
    int n = (seed > 45) ? (200 + (seed - 45) * 30) : (3 + (seed * 7) % 120);
    int poolSize = std::max(1, (seed % 7) + 1);
    std::vector<std::string> pool(poolSize);
    for (int i = 0; i < poolSize; ++i) {
        int len = 1 + (rng() % 32);
        std::string s(len, 'a');
        for (int j = 0; j < len; ++j) s[j] = char('a' + (rng() % 26));
        pool[i] = s;
    }
    std::println("{}", n);
    for (int i = 0; i < n; ++i) {
        std::println("{}", pool[rng() % poolSize]);
    }
    return 0;
}`,
      validatorCpp: `#include <bits/stdc++.h>
int main() {
    int n;
    if (!(std::cin >> n)) return 1;
    if (n < 1 || n > 100000) return 2;
    for (int i = 0; i < n; ++i) {
        std::string s;
        if (!(std::cin >> s)) return 3;
        if (s.empty() || s.size() > 32) return 4;
        for (char c : s) {
            if (c < 'a' || c > 'z') return 5;
        }
    }
    std::string extra;
    if (std::cin >> extra) return 6;
    return 0;
}`,
      referenceCpp: `#include <bits/stdc++.h>
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    if (!(std::cin >> n)) return 0;
    std::unordered_map<std::string, int> cnt;
    cnt.reserve(n * 2);
    for (int i = 0; i < n; ++i) {
        std::string s;
        std::cin >> s;
        int k = cnt[s]++;
        if (k == 0) std::println("OK");
        else std::println("{}{}", s, k);
    }
    return 0;
}`,
      oracleCpp: `#include <bits/stdc++.h>
int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    std::vector<std::string> seen;
    for (int i = 0; i < n; ++i) {
        std::string s;
        std::cin >> s;
        int k = 0;
        for (const auto& prev : seen) {
            if (prev == s) ++k;
        }
        seen.push_back(s);
        if (k == 0) std::println("OK");
        else std::println("{}{}", s, k);
    }
    return 0;
}`,
      wrongSolutions: [
        {
          name: 'always_prints_suffix_1',
          expectedVerdict: 'WA',
          sourceCpp: `#include <bits/stdc++.h>
int main() {
    int n;
    std::cin >> n;
    std::set<std::string> s;
    for (int i = 0; i < n; ++i) {
        std::string u;
        std::cin >> u;
        if (s.insert(u).second) std::println("OK");
        else std::println("{}1", u);
    }
}`
        }
      ],
      seeds
    };
  }

  // Default / Problem 4D (Mysterious Present)
  const seeds = [];
  for (let i = 1; i <= 55; i++) {
    let category = 'special_structure';
    if (i <= 5) category = 'minimum';
    else if (i <= 12) category = 'maximum';
    else if (i <= 22) category = 'boundary';
    else if (i <= 32) category = 'ties';
    else if (i <= 42) category = 'anti_greedy_plausible_wrong';
    else category = 'stress_max_complexity';
    seeds.push({ seed: i, category });
  }
  return {
    planSummary: '50+ distinct generated cases for 4D covering 0-envelope fits, equal-width/equal-height boundary envelopes, multiple optimal chains, anti-greedy DAGs, and semantic checker validation.',
    checkerType: 'custom',
    checkerEps: 1e-6,
    checkerCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    if (argc < 4) return 3;
    std::ifstream fin(argv[1]);
    std::ifstream fout(argv[2]);
    std::ifstream fans(argv[3]);
    if (!fin || !fout || !fans) return 3;

    int n;
    long long w, h;
    if (!(fin >> n >> w >> h)) return 3;
    std::vector<long long> ew(n + 1), eh(n + 1);
    for (int i = 1; i <= n; ++i) fin >> ew[i] >> eh[i];

    int optLen = 0;
    if (!(fans >> optLen)) return 3;

    int userLen = -1;
    if (!(fout >> userLen)) {
        std::println("Missing chain size in output");
        return 1;
    }
    if (userLen != optLen) {
        std::println("Expected maximum chain length {}, got {}", optLen, userLen);
        return 1;
    }
    if (optLen == 0) {
        std::string extra;
        if (fout >> extra) {
            std::println("Trailing tokens after 0");
            return 1;
        }
        std::println("ok empty chain (0)");
        return 0;
    }

    std::vector<int> chain(userLen);
    for (int i = 0; i < userLen; ++i) {
        if (!(fout >> chain[i])) {
            std::println("Expected {} envelope indices, got only {}", userLen, i);
            return 1;
        }
        if (chain[i] < 1 || chain[i] > n) {
            std::println("Envelope index {} out of range [1, {}]", chain[i], n);
            return 1;
        }
    }
    std::string extra;
    if (fout >> extra) {
        std::println("Extra trailing token: {}", extra);
        return 1;
    }
    int first = chain[0];
    if (!(ew[first] > w && eh[first] > h)) {
        std::println("Card ({}x{}) does not strictly fit into first envelope #{} ({}x{})", w, h, first, ew[first], eh[first]);
        return 1;
    }
    for (int i = 1; i < userLen; ++i) {
        int u = chain[i - 1], v = chain[i];
        if (!(ew[u] < ew[v] && eh[u] < eh[v])) {
            std::println("Envelope #{} ({}x{}) does not strictly fit inside #{} ({}x{})", u, ew[u], eh[u], v, ew[v], eh[v]);
            return 1;
        }
    }
    std::println("ok valid envelope chain of length {}", userLen);
    return 0;
}`,
    checkerSelfTests: [
      {
        input: '2 1 1\n2 2\n2 2\n',
        expectedOutput: '1\n1\n',
        candidateOutput: '1\n1\n',
        shouldAccept: true
      },
      {
        input: '2 1 1\n2 2\n2 2\n',
        expectedOutput: '1\n1\n',
        candidateOutput: '1\n2\n',
        shouldAccept: true
      },
      {
        input: '2 1 1\n2 2\n2 2\n',
        expectedOutput: '1\n1\n',
        candidateOutput: '2\n1 2\n',
        shouldAccept: false
      }
    ],
    generatorCpp: `#include <bits/stdc++.h>
int main(int argc, char* argv[]) {
    int seed = (argc > 1) ? std::atoi(argv[1]) : 1;
    std::mt19937 rng(seed * 7919U + 101U);
    if (seed == 1) {
        // No envelope fits
        std::println("3 10 10");
        std::println("10 20");
        std::println("20 10");
        std::println("5 5");
        return 0;
    }
    if (seed == 2) {
        // Equal width trap: must sort height descending when widths are equal
        std::println("4 2 2");
        std::println("5 6");
        std::println("5 10");
        std::println("7 8");
        std::println("9 9");
        return 0;
    }
    int n = (seed > 45) ? (120 + (seed - 45) * 20) : (2 + (seed * 3) % 45);
    long long w = 1 + (rng() % 50);
    long long h = 1 + (rng() % 50);
    std::println("{} {} {}", n, w, h);
    for (int i = 0; i < n; ++i) {
        long long wi = 1 + (rng() % 200);
        long long hi = 1 + (rng() % 200);
        if (seed % 6 == 0) {
            wi = w; // boundary trap
        }
        std::println("{} {}", wi, hi);
    }
    return 0;
}`,
    validatorCpp: `#include <bits/stdc++.h>
int main() {
    int n;
    long long w, h;
    if (!(std::cin >> n >> w >> h)) return 1;
    if (n < 1 || n > 5000 || w < 1 || w > 1000000 || h < 1 || h > 1000000) return 2;
    for (int i = 0; i < n; ++i) {
        long long wi, hi;
        if (!(std::cin >> wi >> hi)) return 3;
        if (wi < 1 || wi > 1000000 || hi < 1 || hi > 1000000) return 4;
    }
    std::string extra;
    if (std::cin >> extra) return 5;
    return 0;
}`,
    referenceCpp: `#include <bits/stdc++.h>
struct Env {
    long long w, h;
    int id;
};
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    long long w, h;
    if (!(std::cin >> n >> w >> h)) return 0;
    std::vector<Env> a;
    for (int i = 1; i <= n; ++i) {
        long long wi, hi;
        std::cin >> wi >> hi;
        if (wi > w && hi > h) a.push_back({wi, hi, i});
    }
    if (a.empty()) {
        std::println("0");
        return 0;
    }
    std::sort(a.begin(), a.end(), [](const Env& x, const Env& y) {
        if (x.w != y.w) return x.w < y.w;
        return x.h < y.h;
    });
    int m = (int)a.size();
    std::vector<int> dp(m, 1), par(m, -1);
    int best = 0;
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < i; ++j) {
            if (a[j].w < a[i].w && a[j].h < a[i].h && dp[j] + 1 > dp[i]) {
                dp[i] = dp[j] + 1;
                par[i] = j;
            }
        }
        if (dp[i] > dp[best]) best = i;
    }
    std::vector<int> path;
    for (int cur = best; cur != -1; cur = par[cur]) path.push_back(a[cur].id);
    std::reverse(path.begin(), path.end());
    std::println("{}", path.size());
    for (size_t i = 0; i < path.size(); ++i) {
        std::print("{}{}", path[i], (i + 1 == path.size()) ? "\\n" : " ");
    }
    return 0;
}`,
    oracleCpp: `#include <bits/stdc++.h>
int main() {
    int n;
    long long w, h;
    if (!(std::cin >> n >> w >> h)) return 0;
    std::vector<long long> ew(n + 1), eh(n + 1);
    for (int i = 1; i <= n; ++i) std::cin >> ew[i] >> eh[i];
    std::vector<int> memo(n + 1, -1), nxt(n + 1, -1);
    auto dfs = [&](auto& self, int u) -> int {
        if (memo[u] != -1) return memo[u];
        int res = 1;
        for (int v = 1; v <= n; ++v) {
            if (ew[v] > ew[u] && eh[v] > eh[u]) {
                int cand = 1 + self(self, v);
                if (cand > res) {
                    res = cand;
                    nxt[u] = v;
                }
            }
        }
        return memo[u] = res;
    };
    int bestLen = 0, start = -1;
    for (int i = 1; i <= n; ++i) {
        if (ew[i] > w && eh[i] > h) {
            int len = dfs(dfs, i);
            if (len > bestLen) {
                bestLen = len;
                start = i;
            }
        }
    }
    if (bestLen == 0) {
        std::println("0");
        return 0;
    }
    std::println("{}", bestLen);
    std::vector<int> chain;
    for (int cur = start; cur != -1; cur = nxt[cur]) chain.push_back(cur);
    for (size_t i = 0; i < chain.size(); ++i) {
        std::print("{}{}", chain[i], (i + 1 == chain.size()) ? "\\n" : " ");
    }
    return 0;
}`,
    wrongSolutions: [
      {
        name: 'greedy_first_increasing_only',
        expectedVerdict: 'WA',
        sourceCpp: `#include <bits/stdc++.h>
struct Env { long long w, h; int id; };
int main() {
    int n; long long w, h;
    std::cin >> n >> w >> h;
    std::vector<Env> a;
    for (int i = 1; i <= n; ++i) {
        long long wi, hi; std::cin >> wi >> hi;
        if (wi > w && hi > h) a.push_back({wi, hi, i});
    }
    if (a.empty()) { std::println("0"); return 0; }
    std::sort(a.begin(), a.end(), [](const Env& x, const Env& y){ return x.w < y.w; });
    std::vector<int> pick = {a[0].id};
    long long cw = a[0].w, ch = a[0].h;
    for (size_t i = 1; i < a.size(); ++i) {
        if (a[i].w > cw && a[i].h > ch) {
            pick.push_back(a[i].id);
            cw = a[i].w; ch = a[i].h;
        }
    }
    std::println("{}", pick.size());
    for (size_t i = 0; i < pick.size(); ++i) std::print("{}{}", pick[i], (i + 1 == pick.size()) ? "\\n" : " ");
}`
      }
    ],
    seeds
  };
}

function buildEditorialResponse(mat) {
  const idx = String(mat.problemIndex || 'D').toUpperCase();
  const hasPublished = Boolean(mat.publishedHtml && mat.publishedHtml.trim());
  const isContest4 = Number(mat.contestId || 4) === 4;

  if (!isContest4) {
    const samples = mat.statement?.samples?.length ? mat.statement.samples : [{ input: '1\n', output: '1\n' }];
    const cppPairs = samples
      .map(
        (s) =>
          `{${JSON.stringify(String(s.input || '').replace(/\r\n/g, '\n').trimEnd())}, ${JSON.stringify(String(s.output || '').replace(/\r\n/g, '\n').trimEnd())}}`
      )
      .join(',\n        ');
    return {
      sourceType: hasPublished ? 'published' : 'ai',
      attributionEn: `AI-Generated Editorial via ${providerLabel}`,
      attributionZh: `AI 生成题解（由 ${providerLabel} 提供）`,
      algorithmEn: `Direct constructive and dynamic analysis for problem ${mat.contestId}${idx}.`,
      correctnessEn: 'Follows directly from the problem constraints and invariant properties.',
      complexityEn: 'Time complexity: $O(n)$. Space complexity: $O(n)$.',
      markdownEn: `### Algorithm & Analysis\n\nSolve problem **${mat.contestId}${idx} (${mat.title || idx})** within the ${mat.timeLimitMs || 2000} ms time limit.`,
      markdownZh: `### 算法分析\n\n在 ${mat.timeLimitMs || 2000} ms 时间限制内求解 **${mat.contestId}${idx} (${mat.title || idx})**。`,
      solutionCpp: `#include <bits/stdc++.h>
int main() {
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    std::string in = ss.str();
    std::string norm;
    for (char c : in) if (c != '\\r') norm.push_back(c);
    while (!norm.empty() && (norm.back() == '\\n' || norm.back() == ' ')) norm.pop_back();
    const std::vector<std::pair<std::string, std::string>> samples = {
        ${cppPairs}
    };
    for (const auto& [sin, sout] : samples) {
        std::string s = sin;
        while (!s.empty() && (s.back() == '\\n' || s.back() == ' ')) s.pop_back();
        if (norm == s) {
            std::cout << sout << "\\n";
            return 0;
        }
    }
    std::cout << norm << "\\n";
    return 0;
}`
    };
  }

  if (idx === 'A') {
    return {
      sourceType: hasPublished ? 'published' : 'ai',
      attributionEn: hasPublished
        ? 'Published Codeforces Beta Round #4 Tutorial by MikeMirzayanov (https://codeforces.com/blog/entry/169)'
        : `AI-Generated Editorial (${providerLabel})`,
      attributionZh: hasPublished
        ? '原作者：MikeMirzayanov — Codeforces Beta Round #4 官方题解 (https://codeforces.com/blog/entry/169)'
        : `AI 生成题解（由 ${providerLabel} 提供）`,
      algorithmEn: 'Check whether $w$ is an even integer strictly greater than $2$ ($w \\bmod 2 = 0$ and $w > 2$).',
      correctnessEn:
        'The sum of two even integers is always even, so any odd $w$ has no valid split. The smallest sum of two positive even numbers is $2 + 2 = 4$, which excludes $w = 2$ (whose only positive split is $1 + 1$). Conversely, every even $w \\ge 4$ can be split into $2$ and $w - 2$, both of which are positive and even.',
      complexityEn: 'Time complexity: $O(1)$. Space complexity: $O(1)$, well within the 1.0 s and 64 MB limits.',
      markdownEn: `We need to determine whether an integer $w$ ($1 \\le w \\le 100$) can be written as $a + b = w$ where $a, b \\ge 2$ are both even.

- **Parity condition:** Since the sum of two even integers is even, any odd $w$ yields \`NO\`.
- **Minimum positive even split:** The smallest sum of two positive even parts is $2 + 2 = 4$. Thus $w = 2$ (which only splits into $1 + 1$) must output \`NO\`.
- **Construction for $w \\ge 4$:** For every even $w \\ge 4$, choosing $a = 2$ and $b = w - 2$ gives two positive even integers.

![Watermelon split diagram](assets/4a-watermelon.svg)

**Complexity:** Time $O(1)$, Space $O(1)$.`,
      markdownZh: `我们需要判断整数 $w$ ($1 \\le w \\le 100$) 是否可以表示为两个正偶数之和 $a + b = w$。

- **奇偶性条件：** 两个偶数之和必为偶数，因此当 $w$ 为奇数时直接输出 \`NO\`。
- **最小正偶数拆分：** 两个正偶数的最小和为 $2 + 2 = 4$，因此 $w = 2$（只能拆分为 $1 + 1$）也必须输出 \`NO\`。
- **偶数构造（$w \\ge 4$）：** 对任意满足 $w \\ge 4$ 的偶数，取 $a = 2, b = w - 2$ 即为合法拆分。

![西瓜切分示意图](assets/4a-watermelon.svg)

**复杂度分析：** 时间复杂度 $O(1)$，空间复杂度 $O(1)$。`,
      solutionCpp: `#include <bits/stdc++.h>
int main() {
    int w;
    std::cin >> w;
    std::println("{}", (w % 2 == 0 && w > 2) ? "YES" : "NO");
}`
    };
  }

  if (idx === 'B') {
    return {
      sourceType: hasPublished ? 'published' : 'ai',
      attributionEn: hasPublished
        ? 'Published Codeforces Beta Round #4 Tutorial by MikeMirzayanov (https://codeforces.com/blog/entry/169)'
        : `AI-Generated Editorial (${providerLabel})`,
      attributionZh: hasPublished
        ? '原作者：MikeMirzayanov — Codeforces Beta Round #4 官方题解 (https://codeforces.com/blog/entry/169)'
        : `AI 生成题解（由 ${providerLabel} 提供）`,
      algorithmEn: 'Compute the minimum possible sum $L = \\sum minTime_i$ and maximum possible sum $R = \\sum maxTime_i$, then greedily distribute $sumTime - L$.',
      correctnessEn:
        'By interval sum closure, a sequence $s_i \\in [minTime_i, maxTime_i]$ summing to $sumTime$ exists iff $L \\le sumTime \\le R$. Starting at $s_i = minTime_i$ and adding $\\min(rem, maxTime_i - minTime_i)$ preserves bounds and exhausts $rem$ because $\\sum (maxTime_i - minTime_i) = R - L \\ge sumTime - L$.',
      complexityEn: 'Time complexity: $O(d)$. Space complexity: $O(d)$ for $d \\le 30$, easily within 0.5 s and 64 MB.',
      markdownEn: `Let $L = \\sum_{i=1}^{d} minTime_i$ and $R = \\sum_{i=1}^{d} maxTime_i$.

1. **Feasibility check:** A valid schedule exists if and only if $L \\le sumTime \\le R$. If $sumTime < L$ or $sumTime > R$, output \`NO\`.
2. **Greedy reconstruction:** Initialize each day with its lower bound $s_i = minTime_i$, leaving $rem = sumTime - L$ hours to allocate. Iterate $i = 1 \\dots d$ and add $\\delta_i = \\min(rem, maxTime_i - minTime_i)$ to $s_i$, subtracting $\\delta_i$ from $rem$.

**Complexity:** Time $O(d)$, Space $O(d)$.`,
      markdownZh: `记 $L = \\sum_{i=1}^{d} minTime_i$，$R = \\sum_{i=1}^{d} maxTime_i$。

1. **可行性判定：** 存在合法时间表当且仅当 $L \\le sumTime \\le R$。若 $sumTime < L$ 或 $sumTime > R$，输出 \`NO\`。
2. **贪心构造：** 先令每天学习时间取下界 $s_i = minTime_i$，剩余待分配时间为 $rem = sumTime - L$。依次遍历第 $i = 1 \\dots d$ 天，向 $s_i$ 增加 $\\delta_i = \\min(rem, maxTime_i - minTime_i)$ 并令 $rem \\leftarrow rem - \\delta_i$。

**复杂度分析：** 时间复杂度 $O(d)$，空间复杂度 $O(d)$。`,
      solutionCpp: `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    std::cin >> d >> sumTime;
    std::vector<int> mn(d), mx(d);
    int L = 0, R = 0;
    for (int i = 0; i < d; ++i) {
        std::cin >> mn[i] >> mx[i];
        L += mn[i]; R += mx[i];
    }
    if (sumTime < L || sumTime > R) { std::println("NO"); return 0; }
    std::println("YES");
    int rem = sumTime - L;
    for (int i = 0; i < d; ++i) {
        int add = std::min(rem, mx[i] - mn[i]);
        rem -= add;
        std::print("{}{}", mn[i] + add, (i + 1 == d) ? "\\n" : " ");
    }
}`
    };
  }

  if (idx === 'C') {
    return {
      sourceType: hasPublished ? 'published' : 'ai',
      attributionEn: hasPublished
        ? 'Published Codeforces Beta Round #4 Tutorial by MikeMirzayanov (https://codeforces.com/blog/entry/169)'
        : `AI-Generated Editorial (${providerLabel})`,
      attributionZh: hasPublished
        ? '原作者：MikeMirzayanov — Codeforces Beta Round #4 官方题解 (https://codeforces.com/blog/entry/169)'
        : `AI 生成题解（由 ${providerLabel} 提供）`,
      algorithmEn: 'Use a hash table `std::unordered_map<std::string, int>` to track occurrence counts of each base name.',
      correctnessEn:
        'Input requests contain only lowercase Latin letters (`a`-`z`), whereas system-generated names end with a positive decimal integer (`name1`, `name2`, ...). Therefore, generated names can never collide with future raw input names, and the $k$-th occurrence of `name` (0-indexed) always receives suffix $k$.',
      complexityEn: 'Time complexity: $O(n \\cdot |s|)$ expected for $n \\le 10^5, |s| \\le 32$, well within the 5.0 s and 64 MB limits.',
      markdownEn: `Maintain a hash table \`std::unordered_map<std::string, int> cnt\` storing how many times each base username has been requested.

- When string $s$ arrives, look up $k = cnt[s]$ and increment $cnt[s]$.
- If $k = 0$, print \`OK\`.
- If $k > 0$, print $s$ followed by the decimal representation of $k$.

Because raw input names consist strictly of lowercase letters (\`a\`–\`z\`), suffixed names like \`abacaba1\` can never be queried directly in the input, so no cross-name collision can occur.

**Complexity:** Time $O(n \\cdot |s|)$ expected, Space $O(n \\cdot |s|)$.`,
      markdownZh: `维护一个哈希表 \`std::unordered_map<std::string, int> cnt\`，记录每个基础用户名被请求的次数。

- 当收到用户名 $s$ 时，读取 $k = cnt[s]$ 并将 $cnt[s]$ 加 $1$。
- 若 $k = 0$，输出 \`OK\`。
- 若 $k > 0$，输出拼接后的新用户名 $s + k$。

由于题目保证输入仅包含小写英文字母（不含数字），带数字后缀的生成名称永远不会与后续原始输入发生跨名冲突。

**复杂度分析：** 期望时间复杂度 $O(n \\cdot |s|)$，空间复杂度 $O(n \\cdot |s|)$。`,
      solutionCpp: `#include <bits/stdc++.h>
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    std::cin >> n;
    std::unordered_map<std::string, int> cnt;
    cnt.reserve(n * 2);
    for (int i = 0; i < n; ++i) {
        std::string s;
        std::cin >> s;
        int k = cnt[s]++;
        if (k == 0) std::println("OK");
        else std::println("{}{}", s, k);
    }
}`
    };
  }

  // Problem 4D (AI-Generated fallback editorial with full algorithm, correctness argument, complexity check, and tested C++23 solution)
  return {
    sourceType: 'ai',
    attributionEn: `AI-Generated Editorial via ${providerLabel} (no published section in original round post; verified against local test suite)`,
    attributionZh: `AI 生成题解 — 由 ${providerLabel} 生成（原比赛官方题解未包含本题，参考代码已通过本地测试包验证）`,
    algorithmEn:
      'Filter envelopes strictly larger than the card ($w_i > w$ and $h_i > h$), sort them by ascending width $(w_i, h_i)$, and compute the Longest Increasing Subsequence (LIS) in both dimensions via $O(m^2)$ Dynamic Programming with parent pointers.',
    correctnessEn:
      'In any valid envelope chain $(a_1, \\dots, a_k)$, widths satisfy $w < w_{a_1} < w_{a_2} < \\dots < w_{a_k}$ and heights satisfy $h < h_{a_1} < h_{a_2} < \\dots < h_{a_k}$. Filtering to envelopes with $w_i > w, h_i > h$ ensures the card fits into the first envelope of any non-empty chain. Sorting by width topological-orders the strict dominance DAG because $w_u < w_v$ implies $u$ appears before $v$. Thus `dp[i] = 1 + max_{j < i, w_j < w_i, h_j < h_i} dp[j]` considers all valid predecessors before state $i$, and backtracking `par[i]` reconstructs a maximum-length chain.',
    complexityEn:
      'Time complexity: $O(n^2)$ where $n \\le 5000$ ($\\approx 1.25 \\times 10^7$ loop iterations, taking $< 40\\text{ ms}$ in C++23, well under the $1.0\\text{ s}$ limit). Space complexity: $O(n)$ ($< 1\\text{ MB}$, well under the $64\\text{ MB}$ limit).',
    markdownEn: `> **Attribution:** *AI-Generated Editorial via ${providerLabel}* (generated because the published round tutorial did not include an explanation for 4D; algorithm limits and reference C++23 solution verified against the local test suite).

### Algorithm
1. **Filter eligible envelopes:** Discard any envelope $i$ with $w_i \\le w$ or $h_i \\le h$, since the card $(w, h)$ cannot fit inside it. If no envelopes remain, output \`0\`.
2. **Topological sort by dimension:** Sort the remaining $m \\le n$ envelopes by ascending width $w_i$ (breaking ties by ascending height $h_i$), preserving each envelope's original 1-based index.
3. **Dynamic Programming on the dominance DAG:** Let $dp[i]$ be the maximum chain length ending at sorted envelope $i$, and $par[i]$ be the index of its predecessor:
   $$dp[i] = 1 + \\max\\bigl(\\{0\\} \\cup \\{dp[j] : 0 \\le j < i,\\; w_j < w_i,\\; h_j < h_i\\}\\bigr)$$
4. **Reconstruction:** Pick $best = \\arg\\max_i dp[i]$, follow $par[best]$ back to $-1$, and reverse the collected original indices.

![Nested envelopes chain diagram](assets/4d-envelopes.svg)

### Correctness Argument
Every valid chain requires strict inequality in both width and height ($w_{a_{t-1}} < w_{a_t}$ and $h_{a_{t-1}} < h_{a_t}$). Because every transition strictly increases $w$, sorting by non-decreasing $w_i$ guarantees that all potential predecessors $j$ of envelope $i$ appear at indices $j < i$. By optimal substructure of longest paths in a DAG, $dp[i]$ inductively computes the exact longest valid chain ending at $i$.

### Complexity & Limit Check
- **Time Complexity:** $O(n \\log n + n^2) = O(n^2)$. For $n \\le 5000$, $\\frac{n(n-1)}{2} \\approx 1.25 \\times 10^7$ comparisons execute in $\\approx 25\\text{ ms}$ in GNU C++23 (\`-O2\`), well within the **1.0 second** time limit.
- **Space Complexity:** $O(n)$ for storing the envelopes, $dp$, and $par$ arrays ($< 200\\text{ KB}$), well within the **64 MB** memory limit.`,
    markdownZh: `> **来源声明：** *AI 生成题解（由 ${providerLabel} 提供）* —— 因原比赛官方博客未包含 4D 题解而自动生成；时空复杂度与配套 C++23 参考代码均已通过本地测试数据验证。

### 算法思路
1. **过滤可用信封：** 丢弃所有满足 $w_i \\le w$ 或 $h_i \\le h$ 的信封（因为贺卡无法放入其中）。若过滤后没有剩余信封，直接输出 \`0\`。
2. **按宽度拓扑排序：** 将剩余的 $m \\le n$ 个信封按宽度 $w_i$ 升序排序（宽度相同时按高度 $h_i$ 升序），并保留每个信封的原始编号 $1 \\dots n$。
3. **二维偏序 DAG 上的动态规划：** 设 $dp[i]$ 表示以排序后第 $i$ 个信封结尾的最大信封链长度，$par[i]$ 记录转移前驱：
   $$dp[i] = 1 + \\max\\bigl(\\{0\\} \\cup \\{dp[j] : 0 \\le j < i,\\; w_j < w_i,\\; h_j < h_i\\}\\bigr)$$
4. **方案回溯：** 取令 $dp[best]$ 最大的下标 $best$，沿 $par$ 数组回溯至 $-1$ 并翻转，即可得到从最小信封到最大信封的编号序列。

![信封链嵌套示意图](assets/4d-envelopes.svg)

### 正确性证明
任何合法信封链都满足宽高严格递增（$w_{a_{t-1}} < w_{a_t}$ 且 $h_{a_{t-1}} < h_{a_t}$）。由于每次转移宽度严格增加，按宽度升序排列后，任意状态 $i$ 的所有合法前驱 $j$ 必然出现在 $j < i$ 的位置，满足有向无环图（DAG）的拓扑序。由 DAG 最长路的最优子结构性质可知，$dp[i]$ 能够准确求出以 $i$ 结尾的最长合法链。

### 复杂度与限制校验
- **时间复杂度：** $O(n \\log n + n^2) = O(n^2)$。当 $n \\le 5000$ 时，外层与内层循环至多进行 $\\frac{n(n-1)}{2} \\approx 1.25 \\times 10^7$ 次比较，在 GNU C++23 (\`-O2\`) 下耗时约 $25\\text{ ms}$，远低于 **1.0 秒**的时间限制。
- **空间复杂度：** $O(n)$，仅需存储信封数组、$dp$ 与 $par$ 数组（不足 $200\\text{ KB}$），远低于 **64 MB** 的内存限制。`,
    solutionCpp: `#include <bits/stdc++.h>
struct Env { long long w, h; int id; };
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n; long long w, h;
    if (!(std::cin >> n >> w >> h)) return 0;
    std::vector<Env> a;
    for (int i = 1; i <= n; ++i) {
        long long wi, hi; std::cin >> wi >> hi;
        if (wi > w && hi > h) a.push_back({wi, hi, i});
    }
    if (a.empty()) { std::println("0"); return 0; }
    std::sort(a.begin(), a.end(), [](const Env& x, const Env& y) {
        return std::tie(x.w, x.h) < std::tie(y.w, y.h);
    });
    int m = (int)a.size();
    std::vector<int> dp(m, 1), par(m, -1);
    int best = 0;
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < i; ++j) {
            if (a[j].w < a[i].w && a[j].h < a[i].h && dp[j] + 1 > dp[i]) {
                dp[i] = dp[j] + 1;
                par[i] = j;
            }
        }
        if (dp[i] > dp[best]) best = i;
    }
    std::vector<int> path;
    for (int cur = best; cur != -1; cur = par[cur]) path.push_back(a[cur].id);
    std::reverse(path.begin(), path.end());
    std::println("{}", path.size());
    for (size_t i = 0; i < path.size(); ++i) {
        std::print("{}{}", path[i], (i + 1 == path.size()) ? "\\n" : " ");
    }
}`
  };
}

let structuredResult = {};
if (materials.taskType === 'translate') {
  structuredResult = buildTranslationResponse(materials);
} else if (materials.taskType === 'test_suite') {
  structuredResult = buildTestSuiteResponse(materials);
} else if (materials.taskType === 'editorial') {
  structuredResult = buildEditorialResponse(materials);
} else {
  structuredResult = { ok: true, echo: materials };
}

if (mode === 'codex') {
  const jsonText = JSON.stringify(structuredResult, null, 2);
  if (outputLastMessagePath) {
    fs.writeFileSync(outputLastMessagePath, jsonText, 'utf8');
  }
  process.stdout.write(jsonText + '\n');
  process.exit(0);
} else {
  // Google Antigravity headless JSON envelope (`agy -p ... --output-format json --json-schema ...`)
  const envelope = {
    conversation_id: `agy-headless-${Date.now()}`,
    status: 'SUCCESS',
    response: JSON.stringify(structuredResult),
    duration_seconds: 0.35,
    num_turns: 1,
    structured_output: structuredResult,
    usage: {
      input_tokens: Math.max(64, stdinText.length),
      output_tokens: 512,
      total_tokens: Math.max(64, stdinText.length) + 512
    }
  };
  process.stdout.write(JSON.stringify(envelope) + '\n');
  process.exit(0);
}
