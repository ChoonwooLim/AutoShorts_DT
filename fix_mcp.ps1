# MCP 설정 파일 읽기
$config = Get-Content 'C:\Users\choon\.claude\claude_desktop_config.json' | ConvertFrom-Json

# Docker 서버 제거 (Docker가 설치되지 않음)
if ($config.mcpServers.docker) {
    $config.mcpServers.PSObject.Properties.Remove("docker")
}

# IDE 서버 제거 (패키지가 존재하지 않음)
if ($config.mcpServers.ide) {
    $config.mcpServers.PSObject.Properties.Remove("ide")
}

# Fetch 서버 제거 (패키지가 존재하지 않음)
if ($config.mcpServers.fetch) {
    $config.mcpServers.PSObject.Properties.Remove("fetch")
}

# 수정된 설정 저장
$config | ConvertTo-Json -Depth 10 | Set-Content 'C:\Users\choon\.claude\claude_desktop_config.json' -Encoding UTF8
Write-Host "MCP configuration cleaned up successfully!"