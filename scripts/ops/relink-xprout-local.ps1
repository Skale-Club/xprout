# Finish the Xprout rename on a computer whose checkout already lives at Dev\xprout:
#   1. relink .env.local to <drive>:\My Drive\Dev\xprout\.env.local (the Drive runtime folder);
#   2. point Codex at the new checkout (same project and chats, new root path).
# Run once per computer in an elevated Windows PowerShell (symlinks need admin), after closing Codex.
# Windows PowerShell 5.1 compatible. No network, no deployment, prints no secrets.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Vanildo\Dev\xprout'
if (-not (Test-Path -LiteralPath "$root\.git\HEAD")) { throw "Checkout not found at $root." }
$stamp = Get-Date -Format 'yyyyMMddHHmmss'

# 1. .env.local -> Drive runtime file (G: on the Surface, N: on the desktop; found by search).
$target = Get-PSDrive -PSProvider FileSystem |
    ForEach-Object { Join-Path $_.Root 'My Drive\Dev\xprout\.env.local' } |
    Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $target) { throw 'My Drive\Dev\xprout\.env.local not found on any drive. Is Google Drive running?' }
$link = Join-Path $root '.env.local'
$item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
if ($item -and -not $item.LinkType) { throw '.env.local is a regular file; refusing to replace it.' }
if ($item) { Remove-Item -LiteralPath $link -Force }
New-Item -ItemType SymbolicLink -Path $link -Target $target | Out-Null
if (-not (Test-Path -LiteralPath $link)) { throw '.env.local link does not resolve.' }
Write-Output ".env.local -> $target"

# 2. Codex. It rewrites its state while open, so never edit it with Codex running.
if (Get-Process -Name 'codex' -ErrorAction SilentlyContinue) {
    Write-Warning 'Codex is open: close it and run this script again to update the Codex project.'
    return
}
$codex = Join-Path $env:USERPROFILE '.codex'
$state = Join-Path $codex '.codex-global-state.json'
if (Test-Path -LiteralPath $state) {
    $raw = [IO.File]::ReadAllText($state)
    # Plain substring replacement keeps the JSON valid; paths are JSON-escaped (double backslash).
    $new = [regex]::Replace($raw, [regex]::Escape('C:\\Users\\Vanildo\\Dev\\xmartmenu'), 'C:\\Users\\Vanildo\\Dev\\xprout', 'IgnoreCase')
    $new = [regex]::Replace($new, [regex]::Escape('C:/Users/Vanildo/Dev/xmartmenu'), 'C:/Users/Vanildo/Dev/xprout', 'IgnoreCase')
    $new = $new.Replace('Skale-Club/xmartmenu', 'Skale-Club/xprout')
    if ($new -ne $raw) {
        Copy-Item -LiteralPath $state -Destination "$state.before-xprout-$stamp"
        [IO.File]::WriteAllText($state, $new)
        Write-Output 'Codex state: project root now Dev\xprout (backup kept).'
    } else { Write-Output 'Codex state: nothing to change.' }
}
$config = Join-Path $codex 'config.toml'
if (Test-Path -LiteralPath $config) {
    $raw = [IO.File]::ReadAllText($config)
    if ($raw -match "(?i)\[projects\.'c:\\users\\vanildo\\dev\\xprout'\]") {
        Write-Output 'Codex config: Dev\xprout is already trusted.'
    } else {
        $new = [regex]::Replace($raw, [regex]::Escape('c:\users\vanildo\dev\xmartmenu'), 'c:\users\vanildo\dev\xprout', 'IgnoreCase')
        if ($new -ne $raw) {
            Copy-Item -LiteralPath $config -Destination "$config.before-xprout-$stamp"
            [IO.File]::WriteAllText($config, $new)
            Write-Output 'Codex config: trust entry moved to Dev\xprout (backup kept).'
        } else { Write-Output 'Codex config: nothing to change.' }
    }
}
Write-Output 'Done. Reopen C:\Users\Vanildo\Dev\xprout in Codex.'
