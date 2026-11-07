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
::  Collimo - installation sur un PC Windows (une fois par PC)
::  Double-clic. Pas besoin de droits d'administrateur.
::  Relancable sans risque : chaque etape deja faite est sautee.
:: ===================================================================
set "REPO=https://github.com/cclaerhout2/collimo.git"
set "OUTILS=%USERPROFILE%\outils"
set "LOG=%TEMP%\collimo-install.log"
set "TMPJ=%TEMP%\collimo-install.json"
set "C_LOG=%LOG%"
set "C_TMPJ=%TMPJ%"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"
:: Proxy d'entreprise : PowerShell reprend le proxy et l'identite Windows.
set "PSNET=$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; [Net.WebRequest]::DefaultWebProxy.Credentials=[Net.CredentialCache]::DefaultNetworkCredentials;"
:: Chemins passes a PowerShell par variables d'environnement (un ' dans le nom d'utilisateur ne casse rien).
set "C_NODEZIP=%TEMP%\collimo-node.zip"
set "C_GITEXE=%TEMP%\collimo-git.exe"
set "C_OUTILS=%OUTILS%"

call :paths

echo.
echo  =============================================
echo   Collimo - installation sur ce PC
echo  =============================================
echo  Ce script installe les outils, recupere le projet depuis GitHub,
echo  connecte ton compte Google et prepare la configuration.
echo.

:: -------------------------------------------------------------------
echo [1/7] Node.js
where node >nul 2>&1
if not errorlevel 1 goto node_ok
echo   Node.js est absent. Collimo peut l'installer dans %OUTILS%\node
echo   (version portable, sans droits d'administrateur).
set "ANS="
<con set /p "ANS=  Installer Node.js maintenant (O/N) ? "
if /i not "%ANS%"=="O" goto nonode
if not exist "%OUTILS%" mkdir "%OUTILS%"
set "NODEV="
for /f "usebackq delims=" %%v in (`%PS% "%PSNET% (Invoke-RestMethod https://nodejs.org/dist/index.json).Where({$_.lts})[0].version"`) do set "NODEV=%%v"
if "%NODEV%"=="" goto nonode
echo   Telechargement de Node.js %NODEV%...
%PS% "%PSNET% Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/%NODEV%/node-%NODEV%-win-x64.zip' -OutFile $env:C_NODEZIP" >"%LOG%" 2>&1
if errorlevel 1 goto nonode
echo   Decompression...
tar -xf "%TEMP%\collimo-node.zip" -C "%OUTILS%" >>"%LOG%" 2>&1
if errorlevel 1 %PS% "Expand-Archive -Force $env:C_NODEZIP $env:C_OUTILS" >>"%LOG%" 2>&1
if exist "%OUTILS%\node" rmdir /s /q "%OUTILS%\node"
ren "%OUTILS%\node-%NODEV%-win-x64" node
del "%TEMP%\collimo-node.zip" >nul 2>&1
call :paths
where node >nul 2>&1
if errorlevel 1 goto nonode
:node_ok
for /f "delims=" %%v in ('node --version') do echo   OK - Node.js %%v

:: -------------------------------------------------------------------
echo [2/7] Git
where git >nul 2>&1
if not errorlevel 1 goto git_ok
echo   Git est absent. Collimo peut installer Git portable dans %OUTILS%\git
echo   (sans droits d'administrateur).
set "ANS="
<con set /p "ANS=  Installer Git maintenant (O/N) ? "
if /i not "%ANS%"=="O" goto nogit
if not exist "%OUTILS%" mkdir "%OUTILS%"
set "GITURL="
for /f "usebackq delims=" %%u in (`%PS% "%PSNET% (Invoke-RestMethod https://api.github.com/repos/git-for-windows/git/releases/latest).assets.Where({$_.name -like 'PortableGit-*-64-bit.7z.exe'})[0].browser_download_url"`) do set "GITURL=%%u"
if "%GITURL%"=="" goto nogit
echo   Telechargement de Git portable...
%PS% "%PSNET% Invoke-WebRequest -UseBasicParsing -Uri '%GITURL%' -OutFile $env:C_GITEXE" >"%LOG%" 2>&1
if errorlevel 1 goto nogit
echo   Decompression (une minute environ)...
"%TEMP%\collimo-git.exe" -o"%OUTILS%\git" -y >>"%LOG%" 2>&1
del "%TEMP%\collimo-git.exe" >nul 2>&1
call :paths
where git >nul 2>&1
if errorlevel 1 goto nogit
:git_ok
for /f "delims=" %%v in ('git --version') do echo   OK - %%v
set "GNAME="
for /f "delims=" %%n in ('git config --global user.name 2^>nul') do set "GNAME=%%n"
if not "%GNAME%"=="" goto git_mail
:git_name_in
set "GNAME="
<con set /p "GNAME=  Ton nom (pour l'historique Git, ex. Cedric Claerhout) : "
if not defined GNAME goto git_name_in
set "GNAME=%GNAME:"=%"
git config --global user.name "%GNAME%"
:git_mail
set "GMAIL="
for /f "delims=" %%m in ('git config --global user.email 2^>nul') do set "GMAIL=%%m"
if not "%GMAIL%"=="" goto step3
:git_mail_in
set "GMAIL="
<con set /p "GMAIL=  Ton adresse e-mail (pour l'historique Git) : "
if not defined GMAIL goto git_mail_in
set "GMAIL=%GMAIL:"=%"
set "GMAIL=%GMAIL: =%"
git config --global user.email "%GMAIL%"

:: -------------------------------------------------------------------
:step3
echo [3/7] Projet Collimo
:: Lance depuis le projet deja telecharge ?
set "DEST=%HERE%"
if exist "%DEST%\.git" if exist "%DEST%\firebase.json" if exist "%DEST%\src\collage" goto proj_ok
set "DEST=%USERPROFILE%\Documents\collimo"
echo   Dossier du projet sur ce PC (Entree = %DEST%)
set "ANS="
<con set /p "ANS=  Dossier : "
if defined ANS set "ANS=%ANS:"=%"
if not "%ANS%"=="" set "DEST=%ANS%"
if exist "%DEST%\.git" goto proj_ok
if exist "%DEST%\*" dir /b "%DEST%" 2>nul | findstr . >nul && goto notempty
echo   Telechargement du projet depuis GitHub (une fenetre de connexion GitHub peut s'ouvrir)...
git clone "%REPO%" "%DEST%"
if errorlevel 1 goto noclone
:proj_ok
cd /d "%DEST%"
echo   OK - projet dans %CD%

:: -------------------------------------------------------------------
echo [4/7] Modules du projet (npm, quelques minutes la premiere fois)
call npm install --no-audit --no-fund >"%LOG%" 2>&1
if errorlevel 1 goto nonpm
echo   OK - modules installes

:: -------------------------------------------------------------------
echo [5/7] Outil Firebase et compte Google
where firebase >nul 2>&1
if not errorlevel 1 goto fb_ok
echo   Installation de l'outil Firebase...
call npm install -g firebase-tools --no-audit --no-fund >"%LOG%" 2>&1
if errorlevel 1 goto nonpm
call :paths
:fb_ok
set "FB=firebase"
where firebase >nul 2>&1
if errorlevel 1 if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
:fb_account
set "FBUSER="
call :fb login:list >"%LOG%" 2>&1
for /f "usebackq delims=" %%e in (`%PS% "$m = Select-String -Path $env:C_LOG -Pattern '[\w.+-]+@[\w-]+(\.[\w-]+)+' -AllMatches; if ($m) { $m[0].Matches[0].Value }"`) do set "FBUSER=%%e"
if "%FBUSER%"=="" goto fb_login
echo   Compte Google connecte a Firebase : %FBUSER%
set "ANS="
<con set /p "ANS=  Est-ce le bon compte (celui qui gere le projet GCP) (O/N) ? "
if /i "%ANS%"=="O" goto step6
call :fb logout >nul 2>&1
:fb_login
echo   Connexion a Google : une page va s'ouvrir dans le navigateur.
call :fb login
if errorlevel 1 goto nologin
goto fb_account

:: -------------------------------------------------------------------
:step6
echo [6/7] Configuration du site Collimo
set "CONFIGURED=1"
if not exist ".env.production" set "CONFIGURED=0"
findstr /c:"REMPLACER" .firebaserc >nul 2>&1 && set "CONFIGURED=0"
if "%CONFIGURED%"=="0" goto cfg_start
call :readcfg
echo   Configuration deja faite : projet %PROJ%, site %SITE%.
echo   (Elle est partagee via GitHub : les autres PC n'ont rien a refaire.)
set "ANS="
<con set /p "ANS=  La modifier (O/N) ? "
if /i not "%ANS%"=="O" goto step7

:cfg_start
echo.
echo   La configuration se fait une seule fois pour tout le monde.
echo   Ouvre-la avec le compte Google qui a les droits sur le projet GCP.
echo.
:cfg_project
set "PROJ="
<con set /p "PROJ=  Identifiant du projet GCP (ex. mon-projet-123) : "
if defined PROJ set "PROJ=%PROJ: =%"
if "%PROJ%"=="" goto cfg_project
echo   Verification du projet...
call :fb projects:list --json >"%TMPJ%" 2>"%LOG%"
set "APPID="
for /f "usebackq delims=" %%n in (`%PS% "(ConvertFrom-Json -InputObject (Get-Content -Raw $env:C_TMPJ)).result.Where({$_.projectId -eq '%PROJ%'})[0].projectNumber"`) do set "APPID=%%n"
if not "%APPID%"=="" goto cfg_site
echo   ERREUR - projet introuvable pour ce compte, ou Firebase non active dessus.
type "%LOG%" 2>nul
echo   Verifie l'identifiant (console.cloud.google.com, en haut a gauche).
set "ANS="
<con set /p "ANS=  Reessayer (O/N) ? "
if /i "%ANS%"=="O" goto cfg_project
goto fail

:cfg_site
echo   OK - projet %PROJ% (numero %APPID%)
echo.
echo   Sites deja heberges dans ce projet (Collimo n'en modifiera aucun) :
call :fb hosting:sites:list --project %PROJ%
set "SITE=%PROJ%-collimo"
echo   Nom du site Collimo, dedie (Entree = %SITE%)
echo   L'adresse sera https://NOM.web.app
set "ANS="
<con set /p "ANS=  Nom du site : "
if defined ANS set "ANS=%ANS: =%"
if not "%ANS%"=="" set "SITE=%ANS%"
call :fb hosting:sites:get %SITE% --project %PROJ% >"%LOG%" 2>&1
if errorlevel 1 goto cfg_site_new
:: Site deja existant : il peut appartenir a une autre application du projet.
:: Le reutiliser ecraserait son contenu a la premiere publication : double confirmation.
echo.
echo   ATTENTION - le site %SITE% existe deja dans ce projet.
echo   S'il sert a une autre application, Collimo la remplacerait a la premiere publication.
echo   Ne le reutilise que s'il a ete cree pour Collimo. Sinon, choisis un autre nom.
set "ANS="
<con set /p "ANS=  Pour le reutiliser, retape exactement son nom (Entree = choisir un autre nom) : "
if defined ANS set "ANS=%ANS: =%"
if not "%ANS%"=="%SITE%" goto cfg_site
goto cfg_site_ok
:cfg_site_new
set "ANS="
<con set /p "ANS=  Le site %SITE% n'existe pas. Le creer (O/N) ? "
if /i not "%ANS%"=="O" goto cfg_site
call :fb hosting:sites:create %SITE% --project %PROJ%
if errorlevel 1 goto cfg_site
:cfg_site_ok
echo   OK - site %SITE%
>".firebaserc" echo {
>>".firebaserc" echo   "projects": {
>>".firebaserc" echo     "default": "%PROJ%"
>>".firebaserc" echo   },
>>".firebaserc" echo   "targets": {
>>".firebaserc" echo     "%PROJ%": {
>>".firebaserc" echo       "hosting": {
>>".firebaserc" echo         "collimo": ["%SITE%"]
>>".firebaserc" echo       }
>>".firebaserc" echo     }
>>".firebaserc" echo   }
>>".firebaserc" echo }

echo.
echo   --- Reglages Google Cloud (pages ouvertes dans le navigateur) ---
echo.
echo   a) Ecran de consentement : verifie qu'il est en "Interne".
echo      Ne change ni son nom ni son logo (communs a tout le projet).
start "" "https://console.cloud.google.com/apis/credentials/consent?project=%PROJ%"
pause <con
echo   b) Active "Google Drive API" puis "Google Picker API" (bouton Activer).
start "" "https://console.cloud.google.com/apis/library/drive.googleapis.com?project=%PROJ%"
start "" "https://console.cloud.google.com/apis/library/picker.googleapis.com?project=%PROJ%"
pause <con
echo   c) Identifiant OAuth : Creer des identifiants ^> ID client OAuth
echo        Type          : Application Web
echo        Nom           : Collimo - Web
echo        Origines JavaScript autorisees (3 lignes) :
echo          https://%SITE%.web.app
echo          https://%SITE%.firebaseapp.com
echo          http://localhost:5173
start "" "https://console.cloud.google.com/apis/credentials?project=%PROJ%"
:cfg_client
set "CID="
<con set /p "CID=     Colle l'ID client (se termine par .apps.googleusercontent.com) : "
if defined CID set "CID=%CID: =%"
echo %CID%| findstr /r /c:"^[0-9][0-9]*-[0-9a-z]*\.apps\.googleusercontent\.com$" >nul || goto cfg_client_bad
goto cfg_key
:cfg_client_bad
echo     Format inattendu, recommence.
goto cfg_client
:cfg_key
echo   d) Cle API : Creer des identifiants ^> Cle API, puis "Modifier la cle" :
echo        Nom                  : Collimo - Picker
echo        Restriction appli    : Sites Web, avec ces 3 lignes :
echo          https://%SITE%.web.app/*
echo          https://%SITE%.firebaseapp.com/*
echo          http://localhost:5173/*
echo        Restriction API      : Google Picker API seulement
:cfg_key_in
set "KEY="
<con set /p "KEY=     Colle la cle API (commence par AIza) : "
if defined KEY set "KEY=%KEY: =%"
echo %KEY%| findstr /b /c:"AIza" >nul || goto cfg_key_bad
goto cfg_domain
:cfg_key_bad
echo     Format inattendu, recommence.
goto cfg_key_in
:cfg_domain
set "DOMAIN="
for /f "tokens=2 delims=@" %%d in ("%FBUSER%") do set "DOMAIN=%%d"
echo   e) Domaine Workspace autorise (Entree = %DOMAIN%)
set "ANS="
<con set /p "ANS=     Domaine : "
if defined ANS set "ANS=%ANS: =%"
if not "%ANS%"=="" set "DOMAIN=%ANS%"
echo   f) Usine a dispositions (facultatif) : identifiant du Drive partage
echo      "Collimo - Catalogue" (la fin de son adresse, apres /folders/).
echo      Entree = le chercher par son nom.
set "CATA="
<con set /p "CATA=     Identifiant : "
if defined CATA set "CATA=%CATA: =%"

>".env.production" echo # Configuration de Collimo, ecrite par install.bat (partagee via GitHub).
>>".env.production" echo # Ces valeurs ne sont pas secretes : elles sont visibles dans le site publie.
>>".env.production" echo VITE_GOOGLE_CLIENT_ID=%CID%
>>".env.production" echo VITE_GOOGLE_API_KEY=%KEY%
>>".env.production" echo VITE_GOOGLE_APP_ID=%APPID%
>>".env.production" echo VITE_ALLOWED_DOMAIN=%DOMAIN%
>>".env.production" echo VITE_CATALOGUE_DRIVE_ID=%CATA%
echo   OK - configuration ecrite (.firebaserc et .env.production)

echo   Envoi de la configuration sur GitHub...
git add .firebaserc .env.production
git diff --cached --quiet
if errorlevel 1 git commit -q -m "Configuration de Collimo (install.bat)"
if errorlevel 1 goto nopush
git pull -q --rebase --autostash origin main
if errorlevel 1 goto pullfail
git push -q origin HEAD:main
if errorlevel 1 goto nopush
echo   OK - configuration partagee

:: -------------------------------------------------------------------
:step7
echo [7/7] Verification : construction du site
call npm run build >"%LOG%" 2>&1
if errorlevel 1 goto nobuild
echo   OK - le site se construit

call :readcfg
echo.
echo  =============================================
echo   Installation terminee
echo  =============================================
echo   Projet  : %CD%
echo   Compte  : %FBUSER%
echo   GCP     : %PROJ%   site : https://%SITE%.web.app
echo.
echo   Prochaine etape : double-clic sur deploy.bat (dans le dossier du projet).
echo   Il publie d'abord une version de test, puis le site sur confirmation.
echo.
echo   A demander une fois a l'administrateur Workspace (voir README) :
echo    - autoriser l'ID client OAuth de Collimo si Drive est filtre ;
echo    - creer le Drive partage "Collimo - Catalogue" pour l'usine.
echo.
start "" "%CD%"
pause <con
exit /b 0

:: ===================================================================
::  Outils
:: ===================================================================
:paths
if exist "%OUTILS%\node\node.exe" set "PATH=%OUTILS%\node;%PATH%"
if exist "%OUTILS%\git\cmd\git.exe" set "PATH=%OUTILS%\git\cmd;%PATH%"
if not exist "%OUTILS%\git\cmd\git.exe" if exist "%OUTILS%\git\bin\git.exe" set "PATH=%OUTILS%\git\bin;%PATH%"
set "PATH=%PATH%;%APPDATA%\npm"
exit /b 0

:: Firebase lance hors du dossier du projet : tant que .firebaserc contient
:: les valeurs a remplacer, l'outil refuse de demarrer dans ce dossier.
:fb
pushd "%TEMP%"
call "%FB%" %*
set "FBERR=%errorlevel%"
popd
exit /b %FBERR%

:readcfg
set "PROJ="
set "SITE="
for /f "usebackq delims=" %%p in (`%PS% "(ConvertFrom-Json -InputObject (Get-Content -Raw '.firebaserc')).projects.default"`) do set "PROJ=%%p"
for /f "usebackq delims=" %%s in (`%PS% "(ConvertFrom-Json -InputObject (Get-Content -Raw '.firebaserc')).targets.PSObject.Properties.Value.hosting.collimo[0]"`) do set "SITE=%%s"
exit /b 0

:: ===================================================================
::  Erreurs connues
:: ===================================================================
:nonode
echo.
echo ERREUR - Node.js n'a pas pu etre installe.
if exist "%LOG%" type "%LOG%"
echo   Telecharge la version "Windows Binary (.zip)" sur https://nodejs.org/
echo   et extrais-la dans %OUTILS%\node (node.exe doit etre dans ce dossier),
echo   puis relance install.bat.
goto fail
:nogit
echo.
echo ERREUR - Git n'a pas pu etre installe.
if exist "%LOG%" type "%LOG%"
echo   Telecharge "PortableGit 64-bit" sur https://git-scm.com/download/win
echo   et extrais-le dans %OUTILS%\git, puis relance install.bat.
goto fail
:notempty
echo.
echo ERREUR - le dossier %DEST% n'est pas vide et n'est pas un projet Collimo.
echo   Choisis un autre dossier, ou vide celui-ci, puis relance install.bat.
goto fail
:noclone
echo.
echo ERREUR - le projet n'a pas pu etre telecharge depuis GitHub.
echo   Verifie que ton compte GitHub a acces a %REPO%
echo   (le proprietaire doit t'inviter sur le depot), puis relance install.bat.
goto fail
:nonpm
echo.
type "%LOG%"
echo ERREUR - npm a echoue (message ci-dessus). Verifie la connexion internet
echo   ou le proxy de l'entreprise, puis relance install.bat.
goto fail
:nologin
echo.
echo ERREUR - connexion Google non terminee. Relance install.bat.
goto fail
:pullfail
git rebase --abort >nul 2>&1
:nopush
echo.
echo ERREUR - la configuration n'a pas pu etre envoyee sur GitHub.
echo   Elle est enregistree sur ce PC. Lance sync.bat puis deploy.bat plus tard.
goto fail
:nobuild
echo.
type "%LOG%"
echo ERREUR - la construction du site a echoue (message ci-dessus).
goto fail
:fail
echo.
pause <con
exit /b 1
