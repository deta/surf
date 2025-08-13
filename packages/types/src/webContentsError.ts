// User friendly error messages for Chrome network errors (generated using an LLM)
// JS Conversion from https://github.com/ccnokes/chrome-network-errors/blob/master/index.js - Cameron Nokes (ISC License)
// Original list of errors from: https://cs.chromium.org/chromium/src/net/base/net_error_list.h

// Ranges:
//   0- 99 System related errors
//   100-199 Connection related errors
//   200-299 Certificate errors
//   300-399 HTTP errors
//   400-499 Cache errors
//   500-599 ?
//   600-699 FTP errors
//   700-799 Certificate manager errors
//   800-899 DNS resolver errors

export type ErrorCode = keyof typeof WEB_CONTENTS_ERRORS

export type WebContentsError = {
  code: number
  description: string
  url: string
}

export type WebContentsErrorParsed = {
  code: number
  name: string
  title: string
  description: string
}

export const WEB_CONTENTS_ERRORS: Record<string, WebContentsErrorParsed> = {
  '-1': {
    code: -1,
    name: 'IO_PENDING',
    title: 'Operation Pending',
    description: 'The operation is still in progress. Please wait.'
  },
  '-2': {
    code: -2,
    name: 'FAILED',
    title: 'Operation Failed',
    description: 'The operation could not be completed. Please try again.'
  },
  '-3': {
    code: -3,
    name: 'ABORTED',
    title: 'Operation Aborted',
    description: 'The operation was canceled. Please try again.'
  },
  '-4': {
    code: -4,
    name: 'INVALID_ARGUMENT',
    title: 'Invalid Argument',
    description: 'An invalid argument was provided. Please check your input and try again.'
  },
  '-5': {
    code: -5,
    name: 'INVALID_HANDLE',
    title: 'Invalid Handle',
    description: 'An invalid handle was encountered. Please restart the application.'
  },
  '-6': {
    code: -6,
    name: 'FILE_NOT_FOUND',
    title: 'File Not Found',
    description: 'The requested file could not be found. Please check the file path.'
  },
  '-7': {
    code: -7,
    name: 'TIMED_OUT',
    title: 'Operation Timed Out',
    description: 'The operation took too long to complete. Please try again later.'
  },
  '-8': {
    code: -8,
    name: 'FILE_TOO_BIG',
    title: 'File Too Large',
    description: 'The file is too large to process. Please try a smaller file.'
  },
  '-9': {
    code: -9,
    name: 'UNEXPECTED',
    title: 'Unexpected Error',
    description: 'An unexpected error occurred. Please try again.'
  },
  '-10': {
    code: -10,
    name: 'ACCESS_DENIED',
    title: 'Access Denied',
    description: 'You do not have permission to access the requested resource.'
  },
  '-11': {
    code: -11,
    name: 'NOT_IMPLEMENTED',
    title: 'Not Implemented',
    description: 'This feature is not yet implemented. Please check back later.'
  },
  '-12': {
    code: -12,
    name: 'INSUFFICIENT_RESOURCES',
    title: 'Insufficient Resources',
    description:
      'There are not enough resources to complete the operation. Please try closing other applications.'
  },
  '-13': {
    code: -13,
    name: 'OUT_OF_MEMORY',
    title: 'Out of Memory',
    description: 'The system has run out of memory. Please try closing other applications.'
  },
  '-14': {
    code: -14,
    name: 'UPLOAD_FILE_CHANGED',
    title: 'Upload File Changed',
    description: 'The file being uploaded has changed. Please try uploading again.'
  },
  '-15': {
    code: -15,
    name: 'SOCKET_NOT_CONNECTED',
    title: 'Socket Not Connected',
    description: 'The socket is not connected. Please check your network connection.'
  },
  '-16': {
    code: -16,
    name: 'FILE_EXISTS',
    title: 'File Already Exists',
    description: 'The file already exists. Please choose a different name.'
  },
  '-17': {
    code: -17,
    name: 'FILE_PATH_TOO_LONG',
    title: 'File Path Too Long',
    description: 'The file path is too long. Please shorten the path and try again.'
  },
  '-18': {
    code: -18,
    name: 'FILE_NO_SPACE',
    title: 'No Space on Device',
    description: 'There is no space left on the device. Please free up some space and try again.'
  },
  '-19': {
    code: -19,
    name: 'FILE_VIRUS_INFECTED',
    title: 'File Infected with Virus',
    description: 'The file is infected with a virus and cannot be opened.'
  },
  '-20': {
    code: -20,
    name: 'BLOCKED_BY_CLIENT',
    title: 'Blocked by Client',
    description: 'The operation was blocked by the client. Please check your settings.'
  },
  '-21': {
    code: -21,
    name: 'NETWORK_CHANGED',
    title: 'Network Changed',
    description: 'The network connection has changed. Please try again.'
  },
  '-22': {
    code: -22,
    name: 'BLOCKED_BY_ADMINISTRATOR',
    title: 'Blocked by Administrator',
    description:
      'The operation was blocked by the administrator. Please contact your administrator.'
  },
  '-23': {
    code: -23,
    name: 'SOCKET_IS_CONNECTED',
    title: 'Socket Already Connected',
    description: 'The socket is already connected. No further action is needed.'
  },
  '-24': {
    code: -24,
    name: 'BLOCKED_ENROLLMENT_CHECK_PENDING',
    title: 'Enrollment Check Pending',
    description: 'Enrollment check is pending. Please wait for completion.'
  },
  '-25': {
    code: -25,
    name: 'UPLOAD_STREAM_REWIND_NOT_SUPPORTED',
    title: 'Upload Stream Rewind Not Supported',
    description: 'Rewinding the upload stream is not supported. Please try again.'
  },
  '-26': {
    code: -26,
    name: 'CONTEXT_SHUT_DOWN',
    title: 'Context Shut Down',
    description: 'The context has been shut down. Please restart the application.'
  },
  '-27': {
    code: -27,
    name: 'BLOCKED_BY_RESPONSE',
    title: 'Blocked by Response',
    description: 'The operation was blocked by the response. Please try again.'
  },
  '-100': {
    code: -100,
    name: 'CONNECTION_CLOSED',
    title: 'Connection Closed',
    description: 'The connection was closed unexpectedly. Please try again.'
  },
  '-101': {
    code: -101,
    name: 'CONNECTION_RESET',
    title: 'Connection Reset',
    description: 'The connection was reset. Please check your network connection.'
  },
  '-102': {
    code: -102,
    name: 'CONNECTION_REFUSED',
    title: 'Website Refused to Connect',
    description: 'The site is not reachable. Please check the URL and try again.'
  },
  '-103': {
    code: -103,
    name: 'CONNECTION_ABORTED',
    title: 'Connection Aborted',
    description: 'The connection was aborted. Please try again.'
  },
  '-104': {
    code: -104,
    name: 'CONNECTION_FAILED',
    title: 'Connection Failed',
    description: 'The connection attempt failed. Please check your network settings.'
  },
  '-105': {
    code: -105,
    name: 'NAME_NOT_RESOLVED',
    title: 'Name Not Resolved',
    description: 'The domain name could not be resolved. Please check the URL.'
  },
  '-106': {
    code: -106,
    name: 'INTERNET_DISCONNECTED',
    title: 'Internet Disconnected',
    description: 'The internet connection is lost. Please check your network connection.'
  },
  '-107': {
    code: -107,
    name: 'SSL_PROTOCOL_ERROR',
    title: 'SSL Protocol Error',
    description: 'There was an error with the SSL protocol. Please try again.'
  },
  '-108': {
    code: -108,
    name: 'ADDRESS_INVALID',
    title: 'Invalid Address',
    description: 'The address provided is invalid. Please check the address and try again.'
  },
  '-109': {
    code: -109,
    name: 'ADDRESS_UNREACHABLE',
    title: 'Address Unreachable',
    description: 'The address is unreachable. Please check your network connection.'
  },
  '-110': {
    code: -110,
    name: 'SSL_CLIENT_AUTH_CERT_NEEDED',
    title: 'Client Certificate Needed',
    description:
      'A client certificate is needed for authentication. Please provide the certificate.'
  },
  '-111': {
    code: -111,
    name: 'TUNNEL_CONNECTION_FAILED',
    title: 'Tunnel Connection Failed',
    description: 'The tunnel connection failed. Please check your network settings.'
  },
  '-112': {
    code: -112,
    name: 'NO_SSL_VERSIONS_ENABLED',
    title: 'No SSL Versions Enabled',
    description: 'No SSL versions are enabled. Please enable SSL and try again.'
  },
  '-113': {
    code: -113,
    name: 'SSL_VERSION_OR_CIPHER_MISMATCH',
    title: 'SSL Version or Cipher Mismatch',
    description: 'There is a mismatch in SSL version or cipher. Please check your SSL settings.'
  },
  '-114': {
    code: -114,
    name: 'SSL_RENEGOTIATION_REQUESTED',
    title: 'SSL Renegotiation Requested',
    description: 'SSL renegotiation was requested. Please try again.'
  },
  '-115': {
    code: -115,
    name: 'PROXY_AUTH_UNSUPPORTED',
    title: 'Proxy Authentication Unsupported',
    description: 'Proxy authentication is unsupported. Please check your proxy settings.'
  },
  '-116': {
    code: -116,
    name: 'CERT_ERROR_IN_SSL_RENEGOTIATION',
    title: 'Certificate Error in SSL Renegotiation',
    description:
      'There was a certificate error during SSL renegotiation. Please check your certificate settings.'
  },
  '-117': {
    code: -117,
    name: 'BAD_SSL_CLIENT_AUTH_CERT',
    title: 'Bad SSL Client Authentication Certificate',
    description:
      'The SSL client authentication certificate is invalid. Please provide a valid certificate.'
  },
  '-118': {
    code: -118,
    name: 'CONNECTION_TIMED_OUT',
    title: 'Connection Timed Out',
    description: 'The connection attempt timed out. Please try again later.'
  },
  '-119': {
    code: -119,
    name: 'HOST_RESOLVER_QUEUE_TOO_LARGE',
    title: 'Host Resolver Queue Too Large',
    description: 'The host resolver queue is too large. Please try again later.'
  },
  '-120': {
    code: -120,
    name: 'SOCKS_CONNECTION_FAILED',
    title: 'SOCKS Connection Failed',
    description: 'The SOCKS connection attempt failed. Please check your SOCKS settings.'
  },
  '-121': {
    code: -121,
    name: 'SOCKS_CONNECTION_HOST_UNREACHABLE',
    title: 'SOCKS Connection Host Unreachable',
    description: 'The SOCKS connection host is unreachable. Please check your network settings.'
  },
  '-122': {
    code: -122,
    name: 'NPN_NEGOTIATION_FAILED',
    title: 'NPN Negotiation Failed',
    description: 'NPN negotiation failed. Please check your network settings.'
  },
  '-123': {
    code: -123,
    name: 'SSL_NO_RENEGOTIATION',
    title: 'SSL No Renegotiation',
    description: 'SSL renegotiation is not supported. Please try again.'
  },
  '-124': {
    code: -124,
    name: 'WINSOCK_UNEXPECTED_WRITTEN_BYTES',
    title: 'Winsock Unexpected Written Bytes',
    description: 'Unexpected bytes were written to Winsock. Please check your network settings.'
  },
  '-125': {
    code: -125,
    name: 'SSL_DECOMPRESSION_FAILURE_ALERT',
    title: 'SSL Decompression Failure Alert',
    description: 'SSL decompression failure alert received. Please check your SSL settings.'
  },
  '-126': {
    code: -126,
    name: 'SSL_BAD_RECORD_MAC_ALERT',
    title: 'SSL Bad Record MAC Alert',
    description: 'SSL bad record MAC alert received. Please check your SSL settings.'
  },
  '-127': {
    code: -127,
    name: 'PROXY_AUTH_REQUESTED',
    title: 'Proxy Authentication Requested',
    description: 'Proxy authentication is required. Please provide the necessary credentials.'
  },
  '-129': {
    code: -129,
    name: 'SSL_WEAK_SERVER_EPHEMERAL_DH_KEY',
    title: 'SSL Weak Server Ephemeral DH Key',
    description: "The server's ephemeral DH key is weak. Please check your SSL settings."
  },
  '-130': {
    code: -130,
    name: 'PROXY_CONNECTION_FAILED',
    title: 'Proxy Connection Failed',
    description: 'The proxy connection attempt failed. Please check your proxy settings.'
  },
  '-131': {
    code: -131,
    name: 'MANDATORY_PROXY_CONFIGURATION_FAILED',
    title: 'Mandatory Proxy Configuration Failed',
    description: 'Mandatory proxy configuration failed. Please check your proxy settings.'
  },
  '-133': {
    code: -133,
    name: 'PRECONNECT_MAX_SOCKET_LIMIT',
    title: 'Preconnect Max Socket Limit Reached',
    description: 'The maximum socket limit for preconnect has been reached. Please try again later.'
  },
  '-134': {
    code: -134,
    name: 'SSL_CLIENT_AUTH_PRIVATE_KEY_ACCESS_DENIED',
    title: 'SSL Client Auth Private Key Access Denied',
    description:
      'Access to the SSL client auth private key was denied. Please check your key permissions.'
  },
  '-135': {
    code: -135,
    name: 'SSL_CLIENT_AUTH_CERT_NO_PRIVATE_KEY',
    title: 'SSL Client Auth Cert No Private Key',
    description:
      'The SSL client auth certificate does not have a private key. Please provide a valid certificate.'
  },
  '-136': {
    code: -136,
    name: 'PROXY_CERTIFICATE_INVALID',
    title: 'Proxy Certificate Invalid',
    description: 'The proxy certificate is invalid. Please check your proxy settings.'
  },
  '-137': {
    code: -137,
    name: 'NAME_RESOLUTION_FAILED',
    title: 'Name Resolution Failed',
    description: 'The domain name resolution failed. Please check your network settings.'
  },
  '-138': {
    code: -138,
    name: 'NETWORK_ACCESS_DENIED',
    title: 'Network Access Denied',
    description: 'Access to the network was denied. Please check your network settings.'
  },
  '-139': {
    code: -139,
    name: 'TEMPORARILY_THROTTLED',
    title: 'Temporarily Throttled',
    description: 'The operation is temporarily throttled. Please try again later.'
  },
  '-140': {
    code: -140,
    name: 'HTTPS_PROXY_TUNNEL_RESPONSE',
    title: 'HTTPS Proxy Tunnel Response Error',
    description:
      'There was an error in the HTTPS proxy tunnel response. Please check your proxy settings.'
  },
  '-141': {
    code: -141,
    name: 'SSL_CLIENT_AUTH_SIGNATURE_FAILED',
    title: 'SSL Client Auth Signature Failed',
    description: 'The SSL client auth signature failed. Please check your certificate settings.'
  },
  '-142': {
    code: -142,
    name: 'MSG_TOO_BIG',
    title: 'Message Too Large',
    description: 'The message is too large to be processed. Please try a smaller message.'
  },
  '-143': {
    code: -143,
    name: 'SPDY_SESSION_ALREADY_EXISTS',
    title: 'SPDY Session Already Exists',
    description: 'An SPDY session already exists. Please try again later.'
  },
  '-145': {
    code: -145,
    name: 'WS_PROTOCOL_ERROR',
    title: 'WebSocket Protocol Error',
    description: 'There was a protocol error with the WebSocket. Please try again.'
  },
  '-147': {
    code: -147,
    name: 'ADDRESS_IN_USE',
    title: 'Address in Use',
    description: 'The address is already in use. Please try a different address.'
  },
  '-148': {
    code: -148,
    name: 'SSL_HANDSHAKE_NOT_COMPLETED',
    title: 'SSL Handshake Not Completed',
    description: 'The SSL handshake was not completed. Please try again.'
  },
  '-149': {
    code: -149,
    name: 'SSL_BAD_PEER_PUBLIC_KEY',
    title: 'SSL Bad Peer Public Key',
    description: "The peer's public key is invalid. Please check your SSL settings."
  },
  '-150': {
    code: -150,
    name: 'SSL_PINNED_KEY_NOT_IN_CERT_CHAIN',
    title: 'SSL Pinned Key Not in Certificate Chain',
    description: 'The pinned key is not in the certificate chain. Please check your SSL settings.'
  },
  '-151': {
    code: -151,
    name: 'CLIENT_AUTH_CERT_TYPE_UNSUPPORTED',
    title: 'Client Auth Certificate Type Unsupported',
    description:
      'The client auth certificate type is unsupported. Please provide a supported certificate.'
  },
  '-152': {
    code: -152,
    name: 'ORIGIN_BOUND_CERT_GENERATION_TYPE_MISMATCH',
    title: 'Origin Bound Certificate Generation Type Mismatch',
    description:
      'There is a mismatch in the origin bound certificate generation type. Please check your certificate settings.'
  },
  '-153': {
    code: -153,
    name: 'SSL_DECRYPT_ERROR_ALERT',
    title: 'SSL Decrypt Error Alert',
    description: 'An SSL decrypt error alert was received. Please check your SSL settings.'
  },
  '-154': {
    code: -154,
    name: 'WS_THROTTLE_QUEUE_TOO_LARGE',
    title: 'WebSocket Throttle Queue Too Large',
    description: 'The WebSocket throttle queue is too large. Please try again later.'
  },
  '-156': {
    code: -156,
    name: 'SSL_SERVER_CERT_CHANGED',
    title: 'SSL Server Certificate Changed',
    description: 'The SSL server certificate has changed. Please check your SSL settings.'
  },
  '-157': {
    code: -157,
    name: 'SSL_INAPPROPRIATE_FALLBACK',
    title: 'SSL Inappropriate Fallback',
    description: 'An inappropriate SSL fallback was attempted. Please check your SSL settings.'
  },
  '-158': {
    code: -158,
    name: 'CT_NO_SCTS_VERIFIED_OK',
    title: 'Certificate Transparency SCTs Not Verified',
    description:
      'The Certificate Transparency SCTs were not verified. Please check your certificate settings.'
  },
  '-159': {
    code: -159,
    name: 'SSL_UNRECOGNIZED_NAME_ALERT',
    title: 'SSL Unrecognized Name Alert',
    description:
      'An unrecognized name alert was received during the SSL handshake. Please check your SSL settings.'
  },
  '-160': {
    code: -160,
    name: 'SOCKET_SET_RECEIVE_BUFFER_SIZE_ERROR',
    title: 'Socket Receive Buffer Size Error',
    description:
      "There was an error setting the socket's receive buffer size. Please check your network settings."
  },
  '-161': {
    code: -161,
    name: 'SOCKET_SET_SEND_BUFFER_SIZE_ERROR',
    title: 'Socket Send Buffer Size Error',
    description:
      "There was an error setting the socket's send buffer size. Please check your network settings."
  },
  '-162': {
    code: -162,
    name: 'SOCKET_RECEIVE_BUFFER_SIZE_UNCHANGEABLE',
    title: 'Socket Receive Buffer Size Unchangeable',
    description:
      "The socket's receive buffer size cannot be changed. Please check your network settings."
  },
  '-163': {
    code: -163,
    name: 'SOCKET_SEND_BUFFER_SIZE_UNCHANGEABLE',
    title: 'Socket Send Buffer Size Unchangeable',
    description:
      "The socket's send buffer size cannot be changed. Please check your network settings."
  },
  '-164': {
    code: -164,
    name: 'SSL_CLIENT_AUTH_CERT_BAD_FORMAT',
    title: 'SSL Client Auth Certificate Bad Format',
    description:
      'The SSL client authentication certificate is in a bad format. Please provide a valid certificate.'
  },
  '-165': {
    code: -165,
    name: 'SSL_FALLBACK_BEYOND_MINIMUM_VERSION',
    title: 'SSL Fallback Beyond Minimum Version',
    description:
      'An SSL fallback beyond the minimum version was attempted. Please check your SSL settings.'
  },
  '-166': {
    code: -166,
    name: 'ICANN_NAME_COLLISION',
    title: 'ICANN Name Collision',
    description:
      "A name collision with ICANN's reserved names occurred. Please check the domain name."
  },
  '-167': {
    code: -167,
    name: 'SSL_SERVER_CERT_BAD_FORMAT',
    title: 'SSL Server Certificate Bad Format',
    description:
      "The SSL server certificate is in a bad format. Please check the server's certificate."
  },
  '-168': {
    code: -168,
    name: 'CT_STH_PARSING_FAILED',
    title: 'Certificate Transparency STH Parsing Failed',
    description:
      'Parsing of the Certificate Transparency Signed Tree Head failed. Please check your CT settings.'
  },
  '-169': {
    code: -169,
    name: 'CT_STH_INCOMPLETE',
    title: 'Certificate Transparency STH Incomplete',
    description:
      'The Certificate Transparency Signed Tree Head is incomplete. Please check your CT settings.'
  },
  '-170': {
    code: -170,
    name: 'UNABLE_TO_REUSE_CONNECTION_FOR_PROXY_AUTH',
    title: 'Unable to Reuse Connection for Proxy Auth',
    description:
      'The connection cannot be reused for proxy authentication. Please check your proxy settings.'
  },
  '-171': {
    code: -171,
    name: 'CT_CONSISTENCY_PROOF_PARSING_FAILED',
    title: 'Certificate Transparency Consistency Proof Parsing Failed',
    description:
      'Parsing of the Certificate Transparency consistency proof failed. Please check your CT settings.'
  },
  '-200': {
    code: -200,
    name: 'CERT_COMMON_NAME_INVALID',
    title: 'Certificate Common Name Invalid',
    description: "The certificate's common name is invalid. Please check the certificate."
  },
  '-201': {
    code: -201,
    name: 'CERT_DATE_INVALID',
    title: 'Certificate Date Invalid',
    description:
      "The certificate's date is invalid. Please check the certificate's validity period."
  },
  '-202': {
    code: -202,
    name: 'CERT_AUTHORITY_INVALID',
    title: 'Certificate Authority Invalid',
    description:
      "The certificate authority is invalid. Please check the certificate's issuing authority."
  },
  '-203': {
    code: -203,
    name: 'CERT_CONTAINS_ERRORS',
    title: 'Certificate Contains Errors',
    description: 'The certificate contains errors. Please check the certificate for issues.'
  },
  '-204': {
    code: -204,
    name: 'CERT_NO_REVOCATION_MECHANISM',
    title: 'Certificate No Revocation Mechanism',
    description:
      "There is no mechanism to check the certificate's revocation status. Please check the certificate."
  },
  '-205': {
    code: -205,
    name: 'CERT_UNABLE_TO_CHECK_REVOCATION',
    title: 'Unable to Check Certificate Revocation',
    description:
      "The certificate's revocation status cannot be checked. Please check your network connection."
  },
  '-206': {
    code: -206,
    name: 'CERT_REVOKED',
    title: 'Certificate Revoked',
    description:
      "The certificate has been revoked. Please check the certificate's revocation status."
  },
  '-207': {
    code: -207,
    name: 'CERT_INVALID',
    title: 'Certificate Invalid',
    description: 'The certificate is invalid. Please check the certificate for issues.'
  },
  '-208': {
    code: -208,
    name: 'CERT_WEAK_SIGNATURE_ALGORITHM',
    title: 'Certificate Weak Signature Algorithm',
    description:
      "The certificate uses a weak signature algorithm. Please check the certificate's signature."
  },
  '-210': {
    code: -210,
    name: 'CERT_NON_UNIQUE_NAME',
    title: 'Certificate Non-Unique Name',
    description: 'The certificate has a non-unique name. Please check the certificate.'
  },
  '-211': {
    code: -211,
    name: 'CERT_WEAK_KEY',
    title: 'Certificate Weak Key',
    description: "The certificate uses a weak key. Please check the certificate's key strength."
  },
  '-212': {
    code: -212,
    name: 'CERT_NAME_CONSTRAINT_VIOLATION',
    title: 'Certificate Name Constraint Violation',
    description: 'The certificate violates name constraints. Please check the certificate.'
  },
  '-213': {
    code: -213,
    name: 'CERT_VALIDITY_TOO_LONG',
    title: 'Certificate Validity Too Long',
    description:
      "The certificate's validity period is too long. Please check the certificate's validity period."
  },
  '-300': {
    code: -300,
    name: 'INVALID_URL',
    title: 'Invalid URL',
    description: 'The URL provided is invalid. Please check the URL and try again.'
  },
  '-301': {
    code: -301,
    name: 'DISALLOWED_URL_SCHEME',
    title: 'Disallowed URL Scheme',
    description: 'The URL scheme is not allowed. Please check the URL and try again.'
  },
  '-302': {
    code: -302,
    name: 'UNKNOWN_URL_SCHEME',
    title: 'Unknown URL Scheme',
    description: 'The URL scheme is unknown. Please check the URL and try again.'
  },
  '-310': {
    code: -310,
    name: 'TOO_MANY_REDIRECTS',
    title: 'Too Many Redirects',
    description: 'The request was redirected too many times. Please try again later.'
  },
  '-311': {
    code: -311,
    name: 'UNSAFE_REDIRECT',
    title: 'Unsafe Redirect',
    description: 'The request was redirected to an unsafe location. Please check the URL.'
  },
  '-312': {
    code: -312,
    name: 'UNSAFE_PORT',
    title: 'Unsafe Port',
    description: 'The request was made to an unsafe port. Please check the URL.'
  },
  '-320': {
    code: -320,
    name: 'INVALID_RESPONSE',
    title: 'Invalid Response',
    description: 'The response received is invalid. Please try again.'
  },
  '-321': {
    code: -321,
    name: 'INVALID_CHUNKED_ENCODING',
    title: 'Invalid Chunked Encoding',
    description: 'The response uses invalid chunked encoding. Please try again.'
  },
  '-322': {
    code: -322,
    name: 'METHOD_NOT_SUPPORTED',
    title: 'Method Not Supported',
    description: 'The request method is not supported. Please check the request method.'
  },
  '-323': {
    code: -323,
    name: 'UNEXPECTED_PROXY_AUTH',
    title: 'Unexpected Proxy Authentication',
    description: 'Unexpected proxy authentication was requested. Please check your proxy settings.'
  },
  '-324': {
    code: -324,
    name: 'EMPTY_RESPONSE',
    title: 'Empty Response',
    description: 'The response is empty. Please try again.'
  },
  '-325': {
    code: -325,
    name: 'RESPONSE_HEADERS_TOO_BIG',
    title: 'Response Headers Too Large',
    description: 'The response headers are too large. Please try again.'
  },
  '-326': {
    code: -326,
    name: 'PAC_STATUS_NOT_OK',
    title: 'PAC Status Not OK',
    description: 'The PAC status is not OK. Please check your proxy settings.'
  },
  '-327': {
    code: -327,
    name: 'PAC_SCRIPT_FAILED',
    title: 'PAC Script Failed',
    description: 'The PAC script execution failed. Please check your proxy settings.'
  },
  '-328': {
    code: -328,
    name: 'REQUEST_RANGE_NOT_SATISFIABLE',
    title: 'Request Range Not Satisfiable',
    description: 'The requested range is not satisfiable. Please check the request range.'
  },
  '-329': {
    code: -329,
    name: 'MALFORMED_IDENTITY',
    title: 'Malformed Identity',
    description: 'The identity is malformed. Please check the identity and try again.'
  },
  '-330': {
    code: -330,
    name: 'CONTENT_DECODING_FAILED',
    title: 'Content Decoding Failed',
    description: 'Content decoding failed. Please try again.'
  },
  '-331': {
    code: -331,
    name: 'NETWORK_IO_SUSPENDED',
    title: 'Network I/O Suspended',
    description: 'Network I/O is suspended. Please try again later.'
  },
  '-332': {
    code: -332,
    name: 'SYN_REPLY_NOT_RECEIVED',
    title: 'SYN Reply Not Received',
    description: 'The SYN reply was not received. Please check your network connection.'
  },
  '-333': {
    code: -333,
    name: 'ENCODING_CONVERSION_FAILED',
    title: 'Encoding Conversion Failed',
    description: 'Encoding conversion failed. Please try again.'
  },
  '-334': {
    code: -334,
    name: 'UNRECOGNIZED_FTP_DIRECTORY_LISTING_FORMAT',
    title: 'Unrecognized FTP Directory Listing Format',
    description: 'The FTP directory listing format is unrecognized. Please check your FTP settings.'
  },
  '-335': {
    code: -335,
    name: 'INVALID_SPDY_STREAM',
    title: 'Invalid SPDY Stream',
    description: 'The SPDY stream is invalid. Please try again.'
  },
  '-336': {
    code: -336,
    name: 'NO_SUPPORTED_PROXIES',
    title: 'No Supported Proxies',
    description: 'No supported proxies were found. Please check your proxy settings.'
  },
  '-337': {
    code: -337,
    name: 'SPDY_PROTOCOL_ERROR',
    title: 'SPDY Protocol Error',
    description: 'An SPDY protocol error occurred. Please try again.'
  },
  '-338': {
    code: -338,
    name: 'INVALID_AUTH_CREDENTIALS',
    title: 'Invalid Authentication Credentials',
    description: 'The authentication credentials are invalid. Please check your credentials.'
  },
  '-339': {
    code: -339,
    name: 'UNSUPPORTED_AUTH_SCHEME',
    title: 'Unsupported Authentication Scheme',
    description:
      'The authentication scheme is unsupported. Please check your authentication settings.'
  },
  '-340': {
    code: -340,
    name: 'ENCODING_DETECTION_FAILED',
    title: 'Encoding Detection Failed',
    description: 'Encoding detection failed. Please try again.'
  },
  '-341': {
    code: -341,
    name: 'MISSING_AUTH_CREDENTIALS',
    title: 'Missing Authentication Credentials',
    description: 'Authentication credentials are missing. Please provide the necessary credentials.'
  },
  '-342': {
    code: -342,
    name: 'UNEXPECTED_SECURITY_LIBRARY_STATUS',
    title: 'Unexpected Security Library Status',
    description: 'An unexpected status was returned by the security library. Please try again.'
  },
  '-343': {
    code: -343,
    name: 'MISCONFIGURED_AUTH_ENVIRONMENT',
    title: 'Misconfigured Authentication Environment',
    description:
      'The authentication environment is misconfigured. Please check your authentication settings.'
  },
  '-344': {
    code: -344,
    name: 'UNDOCUMENTED_SECURITY_LIBRARY_STATUS',
    title: 'Undocumented Security Library Status',
    description: 'An undocumented status was returned by the security library. Please try again.'
  },
  '-345': {
    code: -345,
    name: 'RESPONSE_BODY_TOO_BIG_TO_DRAIN',
    title: 'Response Body Too Large to Drain',
    description: 'The response body is too large to drain. Please try again.'
  },
  '-346': {
    code: -346,
    name: 'RESPONSE_HEADERS_MULTIPLE_CONTENT_LENGTH',
    title: 'Multiple Content-Length Headers',
    description: 'Multiple Content-Length headers were found. Please check the response headers.'
  },
  '-347': {
    code: -347,
    name: 'INCOMPLETE_SPDY_HEADERS',
    title: 'Incomplete SPDY Headers',
    description: 'The SPDY headers are incomplete. Please try again.'
  },
  '-348': {
    code: -348,
    name: 'PAC_NOT_IN_DHCP',
    title: 'PAC Not in DHCP',
    description: 'The PAC file was not found in DHCP. Please check your proxy settings.'
  },
  '-349': {
    code: -349,
    name: 'RESPONSE_HEADERS_MULTIPLE_CONTENT_DISPOSITION',
    title: 'Multiple Content-Disposition Headers',
    description:
      'Multiple Content-Disposition headers were found. Please check the response headers.'
  },
  '-350': {
    code: -350,
    name: 'RESPONSE_HEADERS_MULTIPLE_LOCATION',
    title: 'Multiple Location Headers',
    description: 'Multiple Location headers were found. Please check the response headers.'
  },
  '-351': {
    code: -351,
    name: 'SPDY_SERVER_REFUSED_STREAM',
    title: 'SPDY Server Refused Stream',
    description: 'The SPDY server refused the stream. Please try again.'
  },
  '-352': {
    code: -352,
    name: 'SPDY_PING_FAILED',
    title: 'SPDY Ping Failed',
    description: 'The SPDY ping failed. Please try again.'
  },
  '-354': {
    code: -354,
    name: 'CONTENT_LENGTH_MISMATCH',
    title: 'Content-Length Mismatch',
    description:
      'The Content-Length header does not match the actual content length. Please check the response.'
  },
  '-355': {
    code: -355,
    name: 'INCOMPLETE_CHUNKED_ENCODING',
    title: 'Incomplete Chunked Encoding',
    description: 'The chunked encoding is incomplete. Please try again.'
  },
  '-356': {
    code: -356,
    name: 'QUIC_PROTOCOL_ERROR',
    title: 'QUIC Protocol Error',
    description: 'A QUIC protocol error occurred. Please try again.'
  },
  '-357': {
    code: -357,
    name: 'RESPONSE_HEADERS_TRUNCATED',
    title: 'Response Headers Truncated',
    description: 'The response headers were truncated. Please try again.'
  },
  '-358': {
    code: -358,
    name: 'QUIC_HANDSHAKE_FAILED',
    title: 'QUIC Handshake Failed',
    description: 'The QUIC handshake failed. Please try again.'
  },
  '-360': {
    code: -360,
    name: 'SPDY_INADEQUATE_TRANSPORT_SECURITY',
    title: 'SPDY Inadequate Transport Security',
    description: 'The SPDY transport security is inadequate. Please check your security settings.'
  },
  '-361': {
    code: -361,
    name: 'SPDY_FLOW_CONTROL_ERROR',
    title: 'SPDY Flow Control Error',
    description: 'An SPDY flow control error occurred. Please try again.'
  },
  '-362': {
    code: -362,
    name: 'SPDY_FRAME_SIZE_ERROR',
    title: 'SPDY Frame Size Error',
    description: 'An SPDY frame size error occurred. Please try again.'
  },
  '-363': {
    code: -363,
    name: 'SPDY_COMPRESSION_ERROR',
    title: 'SPDY Compression Error',
    description: 'An SPDY compression error occurred. Please try again.'
  },
  '-364': {
    code: -364,
    name: 'PROXY_AUTH_REQUESTED_WITH_NO_CONNECTION',
    title: 'Proxy Auth Requested with No Connection',
    description:
      'Proxy authentication was requested, but no connection was established. Please check your proxy settings.'
  },
  '-365': {
    code: -365,
    name: 'HTTP_1_1_REQUIRED',
    title: 'HTTP/1.1 Required',
    description: 'The server requires HTTP/1.1. Please check your HTTP settings.'
  },
  '-366': {
    code: -366,
    name: 'PROXY_HTTP_1_1_REQUIRED',
    title: 'Proxy HTTP/1.1 Required',
    description: 'The proxy requires HTTP/1.1. Please check your proxy settings.'
  },
  '-367': {
    code: -367,
    name: 'PAC_SCRIPT_TERMINATED',
    title: 'PAC Script Terminated',
    description: 'The PAC script was terminated. Please check your proxy settings.'
  },
  '-368': {
    code: -368,
    name: 'ALTERNATIVE_CERT_NOT_VALID_FOR_ORIGIN',
    title: 'Alternative Certificate Not Valid for Origin',
    description:
      'The alternative certificate is not valid for the origin. Please check the certificate.'
  },
  '-369': {
    code: -369,
    name: 'TEMPORARY_BACKOFF',
    title: 'Temporary Backoff',
    description: 'The operation is temporarily backed off. Please try again later.'
  },
  '-400': {
    code: -400,
    name: 'CACHE_MISS',
    title: 'Cache Miss',
    description: 'The requested resource was not found in the cache. Please try again.'
  },
  '-401': {
    code: -401,
    name: 'CACHE_READ_FAILURE',
    title: 'Cache Read Failure',
    description: 'Failed to read from the cache. Please try again.'
  },
  '-402': {
    code: -402,
    name: 'CACHE_WRITE_FAILURE',
    title: 'Cache Write Failure',
    description: 'Failed to write to the cache. Please try again.'
  },
  '-403': {
    code: -403,
    name: 'CACHE_OPERATION_NOT_SUPPORTED',
    title: 'Cache Operation Not Supported',
    description: 'The cache operation is not supported. Please check your settings.'
  },
  '-404': {
    code: -404,
    name: 'CACHE_OPEN_FAILURE',
    title: 'Cache Open Failure',
    description: 'Failed to open the cache. Please try again.'
  },
  '-405': {
    code: -405,
    name: 'CACHE_CREATE_FAILURE',
    title: 'Cache Create Failure',
    description: 'Failed to create cache. Please try again.'
  },
  '-406': {
    code: -406,
    name: 'CACHE_RACE',
    title: 'Cache Race Condition',
    description: 'A race condition occurred in the cache. Please try again.'
  },
  '-407': {
    code: -407,
    name: 'CACHE_CHECKSUM_READ_FAILURE',
    title: 'Cache Checksum Read Failure',
    description: 'Failed to read the cache checksum. Please try again.'
  },
  '-408': {
    code: -408,
    name: 'CACHE_CHECKSUM_MISMATCH',
    title: 'Cache Checksum Mismatch',
    description: 'The cache checksum does not match. Please try again.'
  },
  '-409': {
    code: -409,
    name: 'CACHE_LOCK_TIMEOUT',
    title: 'Cache Lock Timeout',
    description: 'The cache lock timed out. Please try again.'
  },
  '-410': {
    code: -410,
    name: 'CACHE_AUTH_FAILURE_AFTER_READ',
    title: 'Cache Authentication Failure After Read',
    description: 'Authentication failed after reading from the cache. Please try again.'
  },
  '-501': {
    code: -501,
    name: 'INSECURE_RESPONSE',
    title: 'Insecure Response',
    description: 'The response was deemed insecure. Please check your security settings.'
  },
  '-502': {
    code: -502,
    name: 'NO_PRIVATE_KEY_FOR_CERT',
    title: 'No Private Key for Certificate',
    description:
      'No private key was found for the certificate. Please check your certificate settings.'
  },
  '-503': {
    code: -503,
    name: 'ADD_USER_CERT_FAILED',
    title: 'Add User Certificate Failed',
    description: 'Failed to add the user certificate. Please try again.'
  },
  '-601': {
    code: -601,
    name: 'FTP_FAILED',
    title: 'FTP Failed',
    description: 'The FTP operation failed. Please check your FTP settings.'
  },
  '-602': {
    code: -602,
    name: 'FTP_SERVICE_UNAVAILABLE',
    title: 'FTP Service Unavailable',
    description: 'The FTP service is unavailable. Please try again later.'
  },
  '-603': {
    code: -603,
    name: 'FTP_TRANSFER_ABORTED',
    title: 'FTP Transfer Aborted',
    description: 'The FTP transfer was aborted. Please try again.'
  },
  '-604': {
    code: -604,
    name: 'FTP_FILE_BUSY',
    title: 'FTP File Busy',
    description: 'The FTP file is busy. Please try again later.'
  },
  '-605': {
    code: -605,
    name: 'FTP_SYNTAX_ERROR',
    title: 'FTP Syntax Error',
    description:
      'There was a syntax error in the FTP command. Please check the command and try again.'
  },
  '-606': {
    code: -606,
    name: 'FTP_COMMAND_NOT_SUPPORTED',
    title: 'FTP Command Not Supported',
    description: 'The FTP command is not supported. Please check your FTP settings.'
  },
  '-607': {
    code: -607,
    name: 'FTP_BAD_COMMAND_SEQUENCE',
    title: 'FTP Bad Command Sequence',
    description: 'The sequence of FTP commands was incorrect. Please check the command order.'
  },
  '-701': {
    code: -701,
    name: 'PKCS12_IMPORT_BAD_PASSWORD',
    title: 'PKCS#12 Import Bad Password',
    description: 'The password for the PKCS#12 file is incorrect. Please try again.'
  },
  '-702': {
    code: -702,
    name: 'PKCS12_IMPORT_FAILED',
    title: 'PKCS#12 Import Failed',
    description: 'Failed to import the PKCS#12 file. Please check the file and try again.'
  },
  '-703': {
    code: -703,
    name: 'IMPORT_CA_CERT_NOT_CA',
    title: 'Import CA Certificate Not a CA',
    description: 'The imported certificate is not a CA certificate. Please check the certificate.'
  },
  '-704': {
    code: -704,
    name: 'IMPORT_CERT_ALREADY_EXISTS',
    title: 'Import Certificate Already Exists',
    description: 'The certificate already exists. Please check your certificates.'
  },
  '-705': {
    code: -705,
    name: 'IMPORT_CA_CERT_FAILED',
    title: 'Import CA Certificate Failed',
    description: 'Failed to import the CA certificate. Please try again.'
  },
  '-706': {
    code: -706,
    name: 'IMPORT_SERVER_CERT_FAILED',
    title: 'Import Server Certificate Failed',
    description: 'Failed to import the server certificate. Please try again.'
  },
  '-707': {
    code: -707,
    name: 'PKCS12_IMPORT_INVALID_MAC',
    title: 'PKCS#12 Import Invalid MAC',
    description: 'The MAC in the PKCS#12 file is invalid. Please check the file.'
  },
  '-708': {
    code: -708,
    name: 'PKCS12_IMPORT_INVALID_FILE',
    title: 'PKCS#12 Import Invalid File',
    description: 'The PKCS#12 file is invalid. Please check the file and try again.'
  },
  '-709': {
    code: -709,
    name: 'PKCS12_IMPORT_UNSUPPORTED',
    title: 'PKCS#12 Import Unsupported',
    description: 'The PKCS#12 file format is unsupported. Please check the file.'
  },
  '-710': {
    code: -710,
    name: 'KEY_GENERATION_FAILED',
    title: 'Key Generation Failed',
    description: 'Failed to generate the key. Please try again.'
  },
  '-712': {
    code: -712,
    name: 'PRIVATE_KEY_EXPORT_FAILED',
    title: 'Private Key Export Failed',
    description: 'Failed to export the private key. Please try again.'
  },
  '-713': {
    code: -713,
    name: 'SELF_SIGNED_CERT_GENERATION_FAILED',
    title: 'Self-Signed Certificate Generation Failed',
    description: 'Failed to generate a self-signed certificate. Please try again.'
  },
  '-714': {
    code: -714,
    name: 'CERT_DATABASE_CHANGED',
    title: 'Certificate Database Changed',
    description: 'The certificate database has changed. Please check your certificates.'
  },
  '-800': {
    code: -800,
    name: 'DNS_MALFORMED_RESPONSE',
    title: 'DNS Malformed Response',
    description: 'The DNS response is malformed. Please check your DNS settings.'
  },
  '-801': {
    code: -801,
    name: 'DNS_SERVER_REQUIRES_TCP',
    title: 'DNS Server Requires TCP',
    description: 'The DNS server requires TCP. Please check your network settings.'
  },
  '-802': {
    code: -802,
    name: 'DNS_SERVER_FAILED',
    title: 'DNS Server Failed',
    description: 'The DNS server failed to respond. Please try again.'
  },
  '-803': {
    code: -803,
    name: 'DNS_TIMED_OUT',
    title: 'DNS Timed Out',
    description: 'The DNS request timed out. Please check your network connection.'
  },
  '-804': {
    code: -804,
    name: 'DNS_CACHE_MISS',
    title: 'DNS Cache Miss',
    description: 'The requested DNS entry was not found in the cache. Please try again.'
  },
  '-805': {
    code: -805,
    name: 'DNS_SEARCH_EMPTY',
    title: 'DNS Search Empty',
    description: 'The DNS search returned no results. Please check your DNS settings.'
  },
  '-806': {
    code: -806,
    name: 'DNS_SORT_ERROR',
    title: 'DNS Sort Error',
    description: 'An error occurred while sorting DNS entries. Please try again.'
  }
}
