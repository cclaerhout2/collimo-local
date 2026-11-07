@echo off
setlocal EnableExtensions
:: Le script se relance depuis une copie dans %TEMP% : une mise a jour de ce
:: fichier par Git pendant qu'il tourne ne peut pas le perturber.
if "%~1"=="--copie" goto main
copy /y "%~f0" "%TEMP%\collimo-%~nx0" >nul
call "%TEMP%\collimo-%~nx0" --copie "%~dp0."
exit /b %errorlevel%
:main
set "HERE=%~f2"
cd /d "%HERE%"

:: ===================================================================
::  Collimo - mettre ce PC a jour depuis GitHub
::  Ne perd jamais de travail local. Ne publie rien (c'est deploy.bat).
:: ===================================================================
set "OUTILS=%USERPROFILE%\outils"
set "LOG=sync.log"
if exist "%LOG%" del "%LOG%"

if exist "%OUTILS%\node\node.exe" set "PATH=%OUTILS%\node;%PATH%"
if exist "%OUTILS%\git\cmd\git.exe" set "PATH=%OUTILS%\git\cmd;%PATH%"
if not exist "%OUTILS%\git\cmd\git.exe" if exist "%OUTILS%\git\bin\git.exe" set "PATH=%OUTILS%\git\bin;%PATH%"
set "PATH=%PATH%;%APPDATA%\npm"
where git >nul 2>&1
if errorlevel 1 goto nogit
git remote get-url origin >nul 2>&1
if errorlevel 1 goto noremote

echo.
echo  Collimo - mise a jour depuis GitHub
echo.
echo [1/3] Recuperation
git fetch -q origin
if errorlevel 1 goto err
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 git branch -q --set-upstream-to=origin/main >nul 2>&1
set "LOCK0="
for /f "delims=" %%h in ('git rev-parse HEAD:package-lock.json 2^>nul') do set "LOCK0=%%h"

echo [2/3] Fusion
git merge-base HEAD origin/main >nul 2>&1
if errorlevel 1 goto unrelated
git pull -q --rebase --autostash origin main
if errorlevel 1 goto err
echo   OK - copie locale a jour
goto modules

:unrelated
echo.
echo   Cette copie n'a jamais ete envoyee sur GitHub : elle n'a aucun
echo   historique commun avec la version GitHub.
set "ANS="
<con set /p "ANS=  Remplacer la copie locale par la version GitHub (O/N) ? "
if /i not "%ANS%"=="O" goto nothing
git add -A
git diff --cached --quiet
if errorlevel 1 git commit -q -m "Sauvegarde avant synchronisation"
if errorlevel 1 goto err
git branch -f sauvegarde-locale HEAD
if errorlevel 1 goto err
git checkout -q -B main origin/main
if errorlevel 1 goto err
git branch -q --set-upstream-to=origin/main
echo   OK - copie locale remplacee par GitHub.
echo   L'ancienne version est gardee dans la branche "sauvegarde-locale".
set "LOCK0=force"

:modules
echo [3/3] Modules du projet
set "LOCK1="
for /f "delims=" %%h in ('git rev-parse HEAD:package-lock.json 2^>nul') do set "LOCK1=%%h"
if not exist "node_modules" set "LOCK0=force"
if "%LOCK0%"=="%LOCK1%" goto modules_ok
where npm >nul 2>&1
if errorlevel 1 goto nonode
echo   Mise a jour des modules (npm)...
call npm install --no-audit --no-fund >"%LOG%" 2>&1
if errorlevel 1 goto errlog
:modules_ok
echo   OK
echo.
echo OK - ce PC est a jour. Pour publier : deploy.bat
pause <con
exit /b 0

:nothing
echo   Rien n'a ete modifie.
pause <con
exit /b 0

:: ===================================================================
::  Erreurs connues
:: ===================================================================
:nogit
echo ERREUR - Git introuvable. Lance d'abord install.bat.
goto fail
:noremote
echo ERREUR - ce dossier n'est pas relie a GitHub. Commande a lancer ici :
echo   git remote add origin https://github.com/cclaerhout2/collimo.git
goto fail
:nonode
echo ERREUR - Node.js introuvable. Lance d'abord install.bat.
goto fail
:errlog
echo.
if exist "%LOG%" type "%LOG%"
echo ERREUR - npm a echoue (message ci-dessus).
goto fail
:err
echo.
git rebase --abort >nul 2>&1
echo ERREUR - Git a refuse l'operation : lis le message ci-dessus.
echo   La copie locale est revenue a son etat d'avant (rien n'est perdu).
echo   Deux PC ont modifie le meme fichier : demande de l'aide pour fusionner.
goto fail
:fail
echo.
pause <con
exit /b 1
