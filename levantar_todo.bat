@echo off
setlocal enabledelayedexpansion
title SOS La Guaira - Full Stack
echo =======================================
echo  SOS LA GUAIRA - Rescate y reunificacion
echo =======================================
echo.

REM PASO 1: Liberar puertos (backend 3000, frontend 5173)
echo Liberando puertos...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
echo Puertos liberados.
echo.

REM PASO 2: Arrancar backend (Node + Express + PostgreSQL)
echo Iniciando backend...
start "SOS Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 4 /nobreak > nul

REM PASO 3: Arrancar frontend (React + Vite)
echo Iniciando frontend...
start "SOS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak > nul

REM PASO 4: Abrir el navegador
echo Abriendo navegador...
start http://localhost:5173

echo.
echo =======================================
echo   SERVICIOS INICIADOS
echo =======================================
echo  Backend:  http://localhost:3000
echo  Frontend: http://localhost:5173
echo  Red local: revisa la ventana del frontend (Network)
echo =======================================
timeout /t 3 /nobreak > nul
exit
