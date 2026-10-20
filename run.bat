@echo off
setlocal
echo ========================================================
echo         Starting Plateful Food Ordering System
echo ========================================================

REM Find Java if JAVA_HOME is not set
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Java\jdk-21" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-21"
    ) else if exist "C:\Program Files\Java\jdk-20" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-20"
    ) else if exist "C:\Program Files\Java\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    )
)

if not "%JAVA_HOME%"=="" (
    echo Using JAVA_HOME: %JAVA_HOME%
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo Plateful auto-detects storage:
echo - If MongoDB is running on localhost:27017, it connects to MongoDB.
echo - If MongoDB is not running, it runs seamlessly in In-Memory mode.
echo.
echo When you see "Started FoodOrderApplication", open:
echo   http://localhost:8080
echo.
echo Admin Login:    admin@food.com  / admin123
echo Owner Login:    owner@lantern.com / owner123
echo Customer Login: sarah@food.com  / sarah123
echo ========================================================
echo.

where mvn >nul 2>nul
if %errorlevel% equ 0 (
    mvn spring-boot:run
) else (
    call .\mvnw.cmd spring-boot:run
)

pause
