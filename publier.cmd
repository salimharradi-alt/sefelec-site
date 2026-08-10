@echo off
REM ============================================================
REM  SEFELEC - Publication du site en ligne
REM
REM  Un seul double-clic pour :
REM    1. regenerer le contenu depuis le back-office
REM    2. enregistrer les modifications
REM    3. les envoyer sur GitHub, qui publie sur l'hebergement
REM
REM  A lancer APRES avoir modifie le contenu dans le back-office.
REM ============================================================

setlocal
set "RACINE=%~dp0"
set "NODE=%RACINE%tools\node-v20.20.2-win-x64"
set "PATH=%NODE%;%PATH%"
cd /d "%RACINE%"

echo.
echo   ============================================
echo     PUBLICATION DU SITE SEFELEC
echo   ============================================
echo.

REM --- 1. Le back-office repond-il ? ---------------------------
echo   [1/4] Verification du back-office...
node -e "require('http').get('http://127.0.0.1:8055/server/ping',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
if errorlevel 1 goto SANS_BUILD

echo         Back-office actif.
echo.
echo   [2/4] Generation du contenu du site...
cd /d "%RACINE%cms"
node scripts/build-static.mjs
if errorlevel 1 goto ERREUR_BUILD
cd /d "%RACINE%"
goto SUITE

:SANS_BUILD
echo.
echo   ATTENTION : le back-office n'est pas demarre.
echo   Le contenu du site ne sera PAS rafraichi.
echo.
echo   Si vous avez modifie des produits, services ou textes,
echo   fermez cette fenetre, lancez demarrer.cmd, puis reessayez.
echo.
pause

:SUITE
echo.
echo   [3/4] Enregistrement des modifications...

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo         Aucune modification a publier.
  echo         Le site en ligne est deja a jour.
  echo.
  pause
  exit /b 0
)

set "HORODATAGE=%date% %time%"
git commit -m "Mise a jour du site - %HORODATAGE%"
if errorlevel 1 goto ERREUR_COMMIT

echo.
echo   [4/4] Envoi vers GitHub...
git push
if errorlevel 1 goto ERREUR_PUSH

echo.
echo   ============================================
echo     PUBLICATION LANCEE
echo   ============================================
echo.
echo   GitHub met le site en ligne dans 1 a 2 minutes.
echo   Suivi en direct dans l'onglet "Actions" de votre depot.
echo.
echo   Ensuite, rechargez votre site avec Ctrl+F5
echo   pour contourner le cache du navigateur.
echo.
pause
exit /b 0

:ERREUR_BUILD
echo.
echo   ECHEC : la generation du contenu a echoue.
echo   Verifiez que le back-office fonctionne (demarrer.cmd).
echo.
pause
exit /b 1

:ERREUR_COMMIT
echo.
echo   ECHEC : impossible d'enregistrer les modifications.
echo   Renseignez votre identite une seule fois :
echo.
echo     git config --global user.name "Votre Nom"
echo     git config --global user.email "vous@exemple.com"
echo.
pause
exit /b 1

:ERREUR_PUSH
echo.
echo   ECHEC : l'envoi vers GitHub a echoue.
echo.
echo   Causes habituelles :
echo     - premiere connexion : ouvrez GitHub Desktop et poussez
echo       une fois depuis l'application, les acces seront memorises
echo     - depot distant non configure : voir DEPLOIEMENT-SEFELEC.md
echo.
pause
exit /b 1
