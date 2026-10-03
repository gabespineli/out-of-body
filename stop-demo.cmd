@echo off
set "OOB_PROJECT=%~dp0"
powershell.exe -NoProfile -Command "$projectPath = $env:OOB_PROJECT.TrimEnd('\'); $listener = Get-NetTCPConnection -LocalPort 3201 -State Listen -ErrorAction SilentlyContinue; foreach ($connection in $listener) { $processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $connection.OwningProcess); if ($processInfo.CommandLine -and $processInfo.CommandLine.IndexOf($projectPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { Stop-Process -Id $connection.OwningProcess; Write-Host 'Out of Body stopped.' } else { Write-Host 'Port 3201 belongs to another application; no process was stopped.' } }; if (-not $listener) { Write-Host 'Out of Body is already stopped.' }"
pause
