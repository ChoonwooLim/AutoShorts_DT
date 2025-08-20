# MCP 설정 파일 읽기
$config = Get-Content 'C:\Users\choon\.claude\claude_desktop_config.json' | ConvertFrom-Json

# SQLite 서버 수정
if (-not $config.mcpServers.sqlite) {
    $config.mcpServers | Add-Member -Name "sqlite" -Value @{} -MemberType NoteProperty -Force
}
$config.mcpServers.sqlite = @{
    command = "npx"
    args = @("-y", "@modelcontextprotocol/server-sqlite", "--db-path", "C:\WORK\test.db")
}

# Fetch 서버 추가
if (-not $config.mcpServers.fetch) {
    $config.mcpServers | Add-Member -Name "fetch" -Value @{} -MemberType NoteProperty -Force
}
$config.mcpServers.fetch = @{
    command = "npx"
    args = @("-y", "@modelcontextprotocol/server-fetch")
}

# Git 서버 추가
if (-not $config.mcpServers.git) {
    $config.mcpServers | Add-Member -Name "git" -Value @{} -MemberType NoteProperty -Force
}
$config.mcpServers.git = @{
    command = "npx"
    args = @("-y", "@modelcontextprotocol/server-git", "--repository", "C:\WORK\AutoShorts_DT")
}

# Blender 서버 추가
if (-not $config.mcpServers.blender) {
    $config.mcpServers | Add-Member -Name "blender" -Value @{} -MemberType NoteProperty -Force
}
$config.mcpServers.blender = @{
    command = "powershell"
    args = @("-c", "cd C:\WORK\TwinVerse\blender-mcp; .venv\Scripts\python.exe -m blender_mcp.server")
}

# IDE 서버 추가
if (-not $config.mcpServers.ide) {
    $config.mcpServers | Add-Member -Name "ide" -Value @{} -MemberType NoteProperty -Force
}
$config.mcpServers.ide = @{
    command = "npx"
    args = @("-y", "claude-ide-server")
}

# 파일 시스템 경로 수정 (C:\WORK 포함)
$config.mcpServers.filesystem.args = @(
    "C:\Users\choon\AppData\Roaming\npm\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js",
    "C:\WORK",
    "C:\Users"
)

# 수정된 설정 저장
$config | ConvertTo-Json -Depth 10 | Set-Content 'C:\Users\choon\.claude\claude_desktop_config.json' -Encoding UTF8
Write-Host "MCP configuration updated successfully!"