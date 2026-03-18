; Avoid false-positive NSIS integrity failures in some Windows environments.
CRCCheck off

; ── 升级时数据保护 ─────────────────────────────────────────────────────────────
; 卸载旧版前：将 settings.json 和 data\state.json 备份到 Temp 目录。
; 安装新版后：从 Temp 目录还原，再清理临时文件。
; 若用户已通过「修改数据路径」将数据存放到自定义目录，那些文件不在安装目录内，
; 无需备份，此处只处理默认路径（安装目录根目录 / data 子目录）下的数据。

!macro customUnInstall
  CreateDirectory "$TEMP\jx3tracker_bak"
  ${If} ${FileExists} "$INSTDIR\settings.json"
    CopyFiles /SILENT "$INSTDIR\settings.json" "$TEMP\jx3tracker_bak\"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\data\state.json"
    CreateDirectory "$TEMP\jx3tracker_bak\data"
    CopyFiles /SILENT "$INSTDIR\data\state.json" "$TEMP\jx3tracker_bak\data\"
  ${EndIf}
!macroend

!macro customInstall
  ${If} ${FileExists} "$TEMP\jx3tracker_bak\settings.json"
    CopyFiles /SILENT "$TEMP\jx3tracker_bak\settings.json" "$INSTDIR\"
  ${EndIf}
  ${If} ${FileExists} "$TEMP\jx3tracker_bak\data\state.json"
    CreateDirectory "$INSTDIR\data"
    CopyFiles /SILENT "$TEMP\jx3tracker_bak\data\state.json" "$INSTDIR\data\"
  ${EndIf}
  RMDir /r "$TEMP\jx3tracker_bak"
!macroend
