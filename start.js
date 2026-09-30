const { spawn } = require('child_process');

console.log("Iniciando o servidor Next.js...");
const nextServer = spawn('npm', ['start'], { stdio: 'inherit', shell: true });

console.log("Iniciando o Bot Runner...");
const botRunner = spawn('node', ['bot-runner.js'], { stdio: 'inherit', shell: true });

nextServer.on('close', (code) => {
  console.log(`Next.js encerrou com código ${code}`);
  process.exit(code);
});

botRunner.on('close', (code) => {
  console.log(`Bot Runner encerrou com código ${code}`);
  process.exit(code);
});
