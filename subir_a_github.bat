@echo off
title Subir RestoFicha a GitHub
color 0B
echo ======================================================================
echo           SUBIR RESTOFICHA POS A TU GITHUB (elector280)
echo ======================================================================
echo.
echo Repositorio: https://github.com/elector280/fichero-de-manganellis.git
echo.

set GIT="C:\Users\elector280\.gemini\antigravity-ide\scratch\mingit\cmd\git.exe"
cd /d "%~dp0"

echo Si te pide credenciales de GitHub:
echo - Usuario: elector280
echo - Contrasena: Tu Personal Access Token (o presiona Enter para abrir navegador)
echo.
echo Ejecutando: git push -u origin main...
echo.

%GIT% push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ==================================================================
    echo  [EXITO] El codigo se subio correctamente a tu GitHub!
    echo  Ahora puedes ir a Render.com y conectar el repositorio.
    echo ==================================================================
) else (
    echo ==================================================================
    echo  [AVISO] Si fallo por contrasena, GitHub requiere un 
    echo  Personal Access Token (entra a github.com/settings/tokens)
    echo ==================================================================
)

echo.
pause
