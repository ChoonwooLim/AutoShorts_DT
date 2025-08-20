# MCP 설정 파일 읽기
$config = Get-Content 'C:\Users\choon\.claude\claude_desktop_config.json' | ConvertFrom-Json

# Git 서버 제거 (MCP 서버 패키지가 없음)
if ($config.mcpServers.git) {
    $config.mcpServers.PSObject.Properties.Remove("git")
}

# 수정된 설정 저장
$config | ConvertTo-Json -Depth 10 | Set-Content 'C:\Users\choon\.claude\claude_desktop_config.json' -Encoding UTF8
Write-Host "Git server removed from MCP configuration!"