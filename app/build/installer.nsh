!define APP_PROGID "surf.deta"
!define VS_REDIST_EXE "vc_redist.x64.exe"
!define VS_REDIST_URL "https://aka.ms/vs/17/release/vc_redist.x64.exe"
!define VS_REDIST_VERSION "14.40.33816.00"

!include "LogicLib.nsh"
!include "x64.nsh"

; Check and install Visual C++ Redistributable if needed
Function CheckVCRedist
    ClearErrors

    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.40\VC\Runtimes\x64" "Version"
    ${If} ${Errors}
        Goto InstallVCRedist
    ${EndIf}

    ${If} $R0 S>= "${VS_REDIST_VERSION}"
        DetailPrint "Visual C++ Redistributable ${VS_REDIST_VERSION} or newer is installed."
        Return
    ${EndIf}

    InstallVCRedist:
    DetailPrint "Required Visual C++ Redistributable ${VS_REDIST_VERSION} is not installed. Downloading..."

    CreateDirectory "$TEMP\vcredist"

    NSISdl::download "${VS_REDIST_URL}" "$TEMP\vcredist\${VS_REDIST_EXE}"
    Pop $R0
    ${If} $R0 == "success"
        DetailPrint "Download successful. Installing Visual C++ Redistributable..."
        ExecWait '"$TEMP\vcredist\${VS_REDIST_EXE}" /quiet /norestart' $R1
        ${If} $R1 == 0
        ${OrIf} $R1 == 3010
            DetailPrint "Visual C++ Redistributable installed successfully."
        ${Else}
            DetailPrint "Visual C++ Redistributable installation failed with code $R1"
            MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to install Visual C++ Redistributable. The application may not work correctly."
        ${EndIf}
    ${Else}
        DetailPrint "Failed to download Visual C++ Redistributable: $R0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to download Visual C++ Redistributable. The application may not work correctly."
    ${EndIf}

    RMDir /r "$TEMP\vcredist"
FunctionEnd

Section -Prerequisites
    Call CheckVCRedist
SectionEnd

; Register as default browser / protocol handler
!macro customInstall
    DetailPrint "Register app as a possible handler for HTTP and HTTPS protocols"

    WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\${PRODUCT_NAME}\Capabilities\URLAssociations" "http" "${APP_PROGID}"
    WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\${PRODUCT_NAME}\Capabilities\URLAssociations" "https" "${APP_PROGID}"

    WriteRegStr HKLM "SOFTWARE\RegisteredApplications" "${PRODUCT_NAME}" "SOFTWARE\Clients\StartMenuInternet\${PRODUCT_NAME}\Capabilities"

    WriteRegStr HKCR "${APP_PROGID}" "" "${PRODUCT_NAME} URL"
    WriteRegStr HKCR "${APP_PROGID}\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
    WriteRegStr HKCR "${APP_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
    DetailPrint "Unregister app as a possible handler for HTTP and HTTPS protocols"

    DeleteRegValue HKLM "SOFTWARE\Clients\StartMenuInternet\${PRODUCT_NAME}\Capabilities\URLAssociations" "http"
    DeleteRegValue HKLM "SOFTWARE\Clients\StartMenuInternet\${PRODUCT_NAME}\Capabilities\URLAssociations" "https"
    DeleteRegValue HKLM "SOFTWARE\RegisteredApplications" "${PRODUCT_NAME}"
    DeleteRegKey HKCR "${APP_PROGID}"
!macroend
