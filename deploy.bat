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
::  Collimo - envoyer son travail et publier le site
::  [1] commit  [2] GitHub  [3] construction  [4] version de test  [5] site
::  Ne publie pour tout le domaine qu'apres confirmation (O/N).
::  Ne deploie QUE le site Collimo (cible hosting:collimo), rien d'autre.
:: ===================================================================
set "OUTILS=%USERPROFILE%\outils"
set "LOG=deploy.log"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"
set "C_LOG=%HERE%\%LOG%"
if exist "%LOG%" del "%LOG%"

if exist "%OUTILS%\node\node.exe" set "PATH=%OUTILS%\node;%PATH%"
if exist "%OUTILS%\git\cmd\git.exe" set "PATH=%OUTILS%\git\cmd;%PATH%"
if not exist "%OUTILS%\git\cmd\git.exe" if exist "%OUTILS%\git\bin\git.exe" set "PATH=%OUTILS%\git\bin;%PATH%"
set "PATH=%PATH%;%APPDATA%\npm"
where git >nul 2>&1
if errorlevel 1 goto nogit
where node >nul 2>&1
if errorlevel 1 goto notools
where firebase >nul 2>&1
if errorlevel 1 goto notools
if not exist ".env.production" goto noconfig
if not exist ".firebaserc" goto noconfig
findstr /c:"REMPLACER" .firebaserc >nul 2>&1 && goto noconfig

set "SITE="
for /f "usebackq delims=" %%s in (`%PS% "(ConvertFrom-Json -InputObject (Get-Content -Raw '.firebaserc')).targets.PSObject.Properties.Value.hosting.collimo[0]"`) do set "SITE=%%s"
if "%SITE%"=="" goto noconfig

echo.
echo  Collimo - deploiement du site %SITE%
echo.
set "MSG="
<con set /p "MSG=Message (ce que tu as change, Entree = maj) : "
if not defined MSG set "MSG=maj"
set "MSG=%MSG:"=%"

:: -------------------------------------------------------------------
echo [1/5] Commit local
git add -A
git diff --cached --quiet
if not errorlevel 1 goto commit_none
git commit -q -m "%MSG%"
if errorlevel 1 goto nocommit
echo   OK - modifications enregistrees
goto step2
:commit_none
echo   OK - rien de nouveau a enregistrer
:step2

:: -------------------------------------------------------------------
echo [2/5] Synchro GitHub
git fetch -q origin
if errorlevel 1 goto err
git merge-base HEAD origin/main >nul 2>&1
if errorlevel 1 goto unrelated
git pull -q --rebase --autostash origin main
if errorlevel 1 goto err
git push -q -u origin HEAD:main
if errorlevel 1 goto err
echo   OK - GitHub a jour

:: -------------------------------------------------------------------
echo [3/5] Construction du site
call npm install --no-audit --no-fund >"%LOG%" 2>&1
if errorlevel 1 goto errlog
call npm run build >>"%LOG%" 2>&1
if errorlevel 1 goto errlog
echo   OK

:: -------------------------------------------------------------------
echo [4/5] Version de test (adresse de test, prolongee a chaque deploiement)
call firebase hosting:channel:deploy test --only collimo --expires 30d --json >"%LOG%" 2>&1
if errorlevel 1 goto errlog
set "TESTURL="
for /f "usebackq delims=" %%u in (`%PS% "$t = Get-Content -Raw $env:C_LOG; $i = $t.IndexOf('{'); if ($i -ge 0) { (ConvertFrom-Json -InputObject $t.Substring($i)).result.PSObject.Properties.Value.url }"`) do set "TESTURL=%%u"
if "%TESTURL%"=="" goto testurl_unknown
echo   OK - a tester ici : %TESTURL%
:: Nouvelle adresse de test : la connexion Google n'y marche qu'une fois l'adresse autorisee.
set "LASTURL="
if exist "test-url.local" set /p LASTURL=<"test-url.local"
if "%LASTURL%"=="%TESTURL%" goto test_open
>"test-url.local" echo %TESTURL%
echo.
echo   Nouvelle adresse de test. Pour pouvoir s'y connecter, ajoute-la une fois
echo   dans la console Google Cloud (page ouverte) :
echo    - ID client "Collimo - Web", Origines JavaScript : %TESTURL%
echo    - Cle "Collimo - Picker", Sites Web : %TESTURL%/*
echo   (Elle reste la meme tant que deploy.bat est lance au moins tous les 30 jours.)
start "" "https://console.cloud.google.com/apis/credentials"
pause <con
:test_open
start "" "%TESTURL%"
goto publish
:testurl_unknown
type "%LOG%"
echo   OK - version de test envoyee (adresse dans le message ci-dessus).
:publish

:: -------------------------------------------------------------------
echo [5/5] Site Collimo
set "ANS="
<con set /p "ANS=Publier cette version pour tout le domaine (O/N) ? "
if /i not "%ANS%"=="O" goto notpublished
call firebase deploy --only hosting:collimo >"%LOG%" 2>&1
if errorlevel 1 goto errlog
echo   OK - en ligne : https://%SITE%.web.app
echo.
echo OK - code a jour sur GitHub, site publie.
pause <con
exit /b 0

:notpublished
echo   Rien n'a ete publie. Le site en ligne reste inchange.
echo.
echo OK - code a jour sur GitHub, version de test : %TESTURL%
pause <con
exit /b 0

:: ===================================================================
::  Erreurs connues
:: ===================================================================
:nogit
echo ERREUR - Git introuvable. Lance d'abord install.bat.
goto fail
:notools
echo ERREUR - Node.js ou l'outil Firebase est introuvable sur ce PC. Lance d'abord install.bat.
goto fail
:noconfig
echo ERREUR - Collimo n'est pas encore configure (projet GCP, site, identifiants).
echo   Lance install.bat, ou sync.bat si un autre PC l'a deja configure.
goto fail
:unrelated
echo ERREUR - cette copie n'a aucun historique commun avec GitHub.
echo   Lance d'abord sync.bat, puis relance deploy.bat.
goto fail
:errlog
echo.
if exist "%LOG%" type "%LOG%"
echo.
echo ERREUR - lis le message ci-dessus (aussi dans %LOG%).
echo   Compte Google refuse : lance install.bat pour changer de compte.
goto fail
:nocommit
echo ERREUR - le commit a echoue (message ci-dessus). Rien n'a ete publie.
echo   Nom ou e-mail Git manquant : relance install.bat.
goto fail
:err
echo.
git rebase --abort >nul 2>&1
echo ERREUR - Git a refuse l'operation : lis le message ci-dessus.
echo   Rien n'a ete publie. Si deux PC ont modifie le meme fichier, lance sync.bat.
goto fail
:fail
echo.
pause <con
exit /b 1
