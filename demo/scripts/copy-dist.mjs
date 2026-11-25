// dist/index.html → linkmatch-demo.html (서버 없이 더블클릭으로 여는 단일 파일)
import { copyFileSync, statSync } from "node:fs";
copyFileSync("dist/index.html", "linkmatch-demo.html");
console.log(`linkmatch-demo.html ${(statSync("linkmatch-demo.html").size / 1024).toFixed(0)} KB`);
