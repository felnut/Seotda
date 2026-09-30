// 앱 버전(major.minor.patch)을 lib/version.json에 쓴다.
//
// 기준은 가장 가까운 릴리즈 태그(vX.Y.Z)이고, 그 태그 이후에 쌓인 커밋으로 올린다.
//   major — 호환을 깨는 커밋 (feat!: 처럼 타입 뒤에 !, 또는 본문에 BREAKING CHANGE)
//   minor — feat 커밋 수
//   patch — 그 밖의 커밋 수 (fix / style / chore / refactor ...)
// 태그를 못 찾거나 git을 쓸 수 없으면(shallow clone 등) 저장된 값을 그대로 쓴다.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "version.json");
const stored = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { major: 0, minor: 0, patch: 0 };

const git = (args) =>
  execSync(`git ${args}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });

let next = stored;

try {
  const tag = git('describe --tags --abbrev=0 --match "v[0-9]*"').trim();
  const [major, minor, patch] = tag.slice(1).split(".").map(Number);

  if ([major, minor, patch].every(Number.isInteger)) {
    const messages = git(`log --no-merges --format=%B%x1e ${tag}..HEAD`)
      .split("\x1e")
      .map((m) => m.trim())
      .filter(Boolean);

    next = { major, minor, patch };

    for (const message of messages) {
      const subject = message.split("\n")[0];

      if (/^\w+(\([^)]*\))?!:/.test(subject) || /^BREAKING[ -]CHANGE/m.test(message)) {
        next.major++;
      } else if (/^feat(\([^)]*\))?:/.test(subject)) {
        next.minor++;
      } else {
        next.patch++;
      }
    }
  }
} catch {
  // 태그가 없거나 git을 쓸 수 없으면 저장된 값을 그대로 쓴다.
}

writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(`version v${next.major}.${next.minor}.${next.patch}`);
