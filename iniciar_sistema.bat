@echo off
title RestoFicha POS - Sistema de Comandas y Fichas
color 0A
echo ======================================================================
echo           RESTOFICHA POS - SERVIDOR LOCAL PARA RESTAURANTE
echo ======================================================================
echo.
echo  Iniciando servidor de sincronizacion en tiempo real...
echo.

cd /d "%~dp0"

:: Verificar si node esta en el PATH o en Archivos de Programa
set NODE_EXE=node
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_EXE="C:\Program Files\nodejs\node.exe"
    ) else (
        echo [ERROR] No se encontro Node.js instalado en el equipo.
        echo Por favor instale Node.js o contacte al administrador.
        pause
        exit /b 1
    )
)

:: Abrir el navegador automaticamente luego de 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Ejecutar el servidor Node.js
%NODE_EXE% server.js

pause
