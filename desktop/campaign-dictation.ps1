param([string]$TestAudio)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
try {
 Add-Type -AssemblyName System.Speech
 $engines=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
 if($engines.Count -eq 0){throw 'No offline Windows speech recognizer is installed. Install a Windows speech language in Settings, or use Windows Voice Access.'}
 $engine=[System.Speech.Recognition.SpeechRecognitionEngine]::new($engines[0])
 $engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
 if($TestAudio){$engine.SetInputToWaveFile($TestAudio)}else{$engine.SetInputToDefaultAudioDevice()}
 @{stage='listening';language=$engines[0].Culture.Name} | ConvertTo-Json -Compress
 while($true){$result=$engine.Recognize([TimeSpan]::FromSeconds(10));if($null -ne $result){@{text=$result.Text;confidence=$result.Confidence} | ConvertTo-Json -Compress};if($TestAudio){break}}
} catch {@{error=$_.Exception.Message} | ConvertTo-Json -Compress;exit 1} finally {if($engine){$engine.Dispose()}}
