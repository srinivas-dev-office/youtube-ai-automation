param (
    [string]$Text = "Here comes the biggest football shot ever! The striker runs up and kicks the ball. Oh no! The goalkeeper makes a crazy save! What a hilarious finish!",
    [string]$OutputFile = ""
)

Add-Type -AssemblyName System.Speech

if (-not $OutputFile) {
    $OutputFile = Join-Path $PSScriptRoot "output\narration.wav"
}

$outDir = Split-Path -Parent $OutputFile
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speech.Rate = 1
$speech.Volume = 100

$voice = $speech.GetInstalledVoices() |
    Where-Object { $_.Enabled } |
    Select-Object -First 1

if ($null -eq $voice) {
    Write-Error "No enabled Windows speech voice found."
    exit 1
}

$speech.SelectVoice($voice.VoiceInfo.Name)

$speech.SetOutputToWaveFile($OutputFile)
$speech.Speak($Text)
$speech.SetOutputToDefaultAudioDevice()
$speech.Dispose()

Write-Host "Voice saved to: $OutputFile"

try {
    $bytes = [System.IO.File]::ReadAllBytes($OutputFile)
    if ($bytes.Length -gt 44) {
        $byteRate = [System.BitConverter]::ToInt32($bytes, 28)
        if ($byteRate -gt 0) {
            $duration = [Math]::Round(($bytes.Length - 44) / $byteRate, 2)
            Write-Host "DURATION_SECONDS:$duration"
        }
    }
} catch {
    # Non-critical fallback
}
