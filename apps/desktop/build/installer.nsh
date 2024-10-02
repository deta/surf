!define APP_PROGID "ea.browser.deta.surf"

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
