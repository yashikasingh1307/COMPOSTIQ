@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing project dependencies for the first time...
  npm install
)
echo Starting COMPOSTIQ React dashboard...
npm run dev -- --host 0.0.0.0
pause
