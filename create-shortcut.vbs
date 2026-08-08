Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
strProjectDir = "C:\BlockQuestEvent"
strBatchPath = strProjectDir & "\start-project.bat"

Set oShortcut = WshShell.CreateShortcut(strDesktop & "\BlockQuest Fiesta.lnk")
oShortcut.TargetPath = strBatchPath
oShortcut.WorkingDirectory = strProjectDir
oShortcut.Description = "One-Click Launcher for BlockQuest Fiesta PH"
oShortcut.WindowStyle = 1
oShortcut.Save

WScript.Echo "Shortcut created successfully on Desktop!"
