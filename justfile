shebang := if os() == 'windows' { 'pwsh.exe' } else { '/usr/bin/env pwsh' }
set shell := ["nu", "-c"]
set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile","-Command"]
source := 'country-flags-emoji.bookmarklet.source.js'
output := 'country-flags-emoji.bookmarklet.txt'

_default:
    @just --list --unsorted

alias dep := deploy
deploy:
    node -e "const fs=require('node:fs'); const src=fs.readFileSync('{{source}}','utf8').replace(/^\uFEFF/,'').replace(/\r?\n/g,' ').replace(/\s{2,}/g,' ').trim(); fs.writeFileSync('{{output}}', 'javascript:' + src + '\n');"
    @Get-Content {{output}} -Raw | Set-Clipboard
    @Get-Content {{output}} -Raw
