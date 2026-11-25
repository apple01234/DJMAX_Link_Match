// dist/index.html → linkmatch-demo.html (서버 없이 더블클릭으로 여는 단일 파일)
//                  → ../public/demo.html (배포된 사이트의 /demo 에서 열림)
import { copyFileSync, statSync } from "node:fs";
copyFileSync("dist/index.html", "linkmatch-demo.html");
copyFileSync("dist/index.html", "../public/demo.html");
console.log(`linkmatch-demo.html · ../public/demo.html ${(statSync("linkmatch-demo.html").size / 1024).toFixed(0)} KB`);
