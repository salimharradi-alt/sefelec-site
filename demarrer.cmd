@echo off
REM ============================================================
REM  SEFELEC — Demarrage du projet complet
REM
REM  Lance les deux services et ouvre le site :
REM    - Directus  : interne, 127.0.0.1:8055 (non expose)
REM    - Serveur   : http://localhost:5500
REM
REM  Site public : http://localhost:5500
REM  Back-office : http://localhost:5500/admin
REM ============================================================

setlocal
set "RACINE=%~dp0"
set "NODE=%RACINE%tools\node-v20.20.2-win-x64"
set "PATH=%NODE%;%PATH%"

echo.
echo   Demarrage de SEFELEC...
echo.

REM --- 1. Back-office Directus (fenetre separee, ecoute en interne) ---
start "SEFELEC - Directus (interne)" /min cmd /c "cd /d "%RACINE%cms" && "%RACINE%cms\node_modules\.bin\directus.cmd" start"

REM --- 2. Attente du demarrage de Directus ---
echo   Initialisation du back-office...
timeout /t 12 /nobreak >nul

REM --- 3. Serveur unifie sur le port 5500 ---
echo.
echo   ============================================
echo     Site public   http://localhost:5500
echo     Back-office   http://localhost:5500/admin
echo   ============================================
echo.
echo   Fermez cette fenetre pour arreter le projet.
echo.

start "" http://localhost:5500

node "%RACINE%server.js"

pause
