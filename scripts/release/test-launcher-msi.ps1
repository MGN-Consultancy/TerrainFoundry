param([Parameter(Mandatory=$true)][string]$File)
$ErrorActionPreference='Stop'
$installer=New-Object -ComObject WindowsInstaller.Installer
$database=$installer.OpenDatabase((Resolve-Path -LiteralPath $File).Path,0)
$view=$database.OpenView('SELECT `Shortcut`, `Directory_`, `Target`, `Icon_` FROM `Shortcut`')
$view.Execute()
$shortcuts=@{}
while($record=$view.Fetch()){$shortcuts[$record.StringData(1)]=@($record.StringData(2),$record.StringData(3),$record.StringData(4))}
$view.Close()
foreach($id in @('DesktopShortcutLink','StartMenuShortcut')){
  if(!$shortcuts.ContainsKey($id)){throw "Missing shortcut: $id"}
  if($shortcuts[$id][1] -ne '[INSTALLFOLDER]TerrainFoundryLauncher.exe'){throw 'Shortcut must launch the updater'}
  if($shortcuts[$id][2] -ne 'FoundryIcon'){throw 'Shortcut icon is missing'}
}
if($shortcuts['DesktopShortcutLink'][0] -ne 'DesktopFolder'){throw 'Desktop shortcut is not on the user desktop'}
$view=$database.OpenView('SELECT `Name` FROM `Icon`')
$view.Execute();$record=$view.Fetch()
if(!$record -or $record.StringData(1) -ne 'FoundryIcon'){throw 'Embedded installer icon is missing'}
$view.Close()
foreach($dialog in @('WelcomeDlg','LicenseAgreementDlg','InstallDirDlg','VerifyReadyDlg','ProgressDlg','ExitDialog')){
  $view=$database.OpenView('SELECT `Dialog` FROM `Dialog` WHERE `Dialog` = '''+$dialog+'''')
  $view.Execute();if(!$view.Fetch()){throw "Missing wizard page: $dialog"};$view.Close()
}
$view=$database.OpenView('SELECT `File` FROM `File` WHERE `File` = ''InstallationMarker''')
$view.Execute();if(!$view.Fetch()){throw 'Chosen-folder marker is missing'};$view.Close()
$view=$database.OpenView('SELECT `Value` FROM `Property` WHERE `Property` = ''WIXUI_INSTALLDIR''')
$view.Execute();$record=$view.Fetch();if(!$record -or $record.StringData(1) -ne 'INSTALLFOLDER'){throw 'Folder chooser does not control installation folder'};$view.Close()
$view=$database.OpenView('SELECT `Name`, `Value` FROM `Registry` WHERE `Name` = ''InstallDirectory''')
$view.Execute();$record=$view.Fetch();if(!$record -or $record.StringData(2) -ne '[INSTALLFOLDER]'){throw 'MSI upgrades cannot recover the chosen folder'};$view.Close()
Write-Output 'PASS: welcome, licence, folder, confirmation, progress and finish pages; selected folder persisted for updates.'
Write-Output 'PASS: MSI contains desktop and Start menu shortcuts targeting the updater, with an embedded Terrain Foundry icon.'
