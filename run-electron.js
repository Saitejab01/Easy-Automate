const proc = require('child_process');
const electron = require('electron');

// Ensure ELECTRON_RUN_AS_NODE is stripped completely from the environment
// because VS Code / IDE terminals inject ELECTRON_RUN_AS_NODE=1 which causes
// Electron to boot in headless CLI node mode rather than desktop GUI app mode.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = proc.spawn(electron, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
  env
});

child.on('close', function (code, signal) {
  if (code === null) {
    process.exit(1);
  }
  process.exit(code);
});

const handleTerminationSignal = function (signal) {
  process.on(signal, function () {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

handleTerminationSignal('SIGINT');
handleTerminationSignal('SIGTERM');

