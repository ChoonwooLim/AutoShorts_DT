# MCP 설정 파일 읽기
$config = Get-Content 'C:\Users\choon\.claude\claude_desktop_config.json' | ConvertFrom-Json

# TwinVerse MCP 서버 추가
if (-not $config.mcpServers.twinverse) {
    $config.mcpServers | Add-Member -Name "twinverse" -Value @{} -MemberType NoteProperty -Force
}

$config.mcpServers.twinverse = @{
    command = "node"
    args = @("C:\WORK\TwinVerse\twinverse-mcp\dist\index.js")
}

# 수정된 설정 저장
$config | ConvertTo-Json -Depth 10 | Set-Content 'C:\Users\choon\.claude\claude_desktop_config.json' -Encoding UTF8
Write-Host "TwinVerse MCP server added to Claude configuration!"