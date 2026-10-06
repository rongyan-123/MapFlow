$ErrorActionPreference = 'Stop'
$relayMutex = [System.Threading.Mutex]::new($false, 'Local\MapFlowVmqRelay28080')
if (-not $relayMutex.WaitOne(0)) { exit }
$adbExecutable = 'D:\MuMu\nx_main\adb.exe'
$sshExecutable = 'C:\Windows\System32\OpenSSH\ssh.exe'
$relayProcess = $null
try {
    while ($true) {
        if (Test-Path -LiteralPath $adbExecutable) {
            & $adbExecutable connect 127.0.0.1:16384 *> $null
            & $adbExecutable -s 127.0.0.1:16384 reverse tcp:28080 tcp:28080 *> $null
        }
        $relayProcess = Start-Process -FilePath $sshExecutable -ArgumentList @('-N','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3','-L','127.0.0.1:28080:127.0.0.1:28080','rong-frp') -WindowStyle Hidden -PassThru
        while (-not $relayProcess.HasExited) {
            if (Test-Path -LiteralPath $adbExecutable) {
                & $adbExecutable connect 127.0.0.1:16384 *> $null
                & $adbExecutable -s 127.0.0.1:16384 reverse tcp:28080 tcp:28080 *> $null
            }
            Start-Sleep -Seconds 15
            $relayProcess.Refresh()
        }
        Start-Sleep -Seconds 5
    }
} finally {
    if ($relayProcess -and -not $relayProcess.HasExited) { Stop-Process -Id $relayProcess.Id }
    $relayMutex.ReleaseMutex()
    $relayMutex.Dispose()
}
