# MCP 설정 파일 읽기
$config = Get-Content 'C:\Users\choon\.claude\claude_desktop_config.json' | ConvertFrom-Json

# SQLite 서버 설정 수정 (mcp-sqlite 패키지 사용)
$config.mcpServers.sqlite = @{
    command = "node"
    args = @(
        "C:\Users\choon\AppData\Roaming\npm\node_modules\mcp-sqlite\dist\index.js",
        "--db-path",
        "C:\WORK\test.db"
    )
}

# Git 서버 설정 수정 (깃 디렉토리 지정)
$config.mcpServers.git = @{
    command = "git"
    args = @("--version")  # 일단 git 버전 확인으로 설정
}

# 수정된 설정 저장
$config | ConvertTo-Json -Depth 10 | Set-Content 'C:\Users\choon\.claude\claude_desktop_config.json' -Encoding UTF8
Write-Host "MCP configuration finalized successfully!"