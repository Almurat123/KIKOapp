      http2Options: undefined,
      hostname: 'kiko-python-production.up.railway.app',
      port: '',
      agent: undefined,
      nativeProtocols: [Object],
      pathname: '/moderation/input'
    },
    _ended: true,
    _ending: true,
    _redirectCount: 0,
    _redirects: [],
    _requestBodyLength: 28,
    _requestBodyBuffers: [ [Object] ],
    _eventsCount: 3,
    _onNativeResponse: [Function (anonymous)],
    _currentRequest: ClientRequest {
      _events: [Object: null prototype],
      _eventsCount: 2,
      _maxListeners: undefined,
      outputData: [],
      outputSize: 0,
      writable: true,
      destroyed: true,
      _last: false,
      chunkedEncoding: false,
      shouldKeepAlive: true,
      maxRequestsOnConnectionReached: false,
      _defaultKeepAlive: true,
      useChunkedEncodingByDefault: true,
      sendDate: false,
      _removedConnection: false,
      _removedContLen: false,
      _removedTE: false,
      strictContentLength: false,
      _contentLength: 28,
      _hasBody: true,
      _trailer: '',
      finished: true,
      timeoutCb: [Function: emitRequestTimeout],
      upgradeOrConnect: false,
      path: '/moderation/input',
      joinDuplicateHeaders: undefined,
      _ended: false,
      res: null,
      aborted: false,
      _headerSent: true,
        'Connection: keep-alive\r\n' +
      _closed: false,
        '\r\n',
      socket: [TLSSocket],
      _keepAliveTimeout: 0,
      _header: 'POST /moderation/input HTTP/1.1\r\n' +
      _onPendingData: [Function: nop],
        'Accept: application/json, text/plain, */*\r\n' +
      agent: [Agent],
        'Content-Type: application/json\r\n' +
      socketPath: undefined,
        'User-Agent: axios/1.13.2\r\n' +
      method: 'POST',
        'Content-Length: 28\r\n' +
      maxHeaderSize: undefined,
        'Accept-Encoding: gzip, compress, deflate, br\r\n' +
      insecureHTTPParser: undefined,
        'Host: kiko-python-production.up.railway.app\r\n' +
      parser: null,
      maxHeadersCount: null,
      reusedSocket: false,
      host: 'kiko-python-production.up.railway.app',
      protocol: 'https:',
      _redirectable: [Circular *2],
      [Symbol(shapeMode)]: false,
      [Symbol(kCapture)]: false,
      [Symbol(kBytesWritten)]: 0,
      [Symbol(kNeedDrain)]: false,
      [Symbol(corked)]: 0,
      [Symbol(kOutHeaders)]: [Object: null prototype],
      [Symbol(errored)]: null,
      [Symbol(kHighWaterMark)]: 16384,
      [Symbol(kRejectNonStandardBodyWrites)]: false,
      [Symbol(kUniqueHeaders)]: null,
      [Symbol(kError)]: [Circular *1]
    },
    _currentUrl: 'https://kiko-python-production.up.railway.app/moderation/input',
    _timeout: null,
    [Symbol(shapeMode)]: true,
    [Symbol(kCapture)]: false
  }
}
[ChatWorker] Grok: Sent message_start for cmk57eern00kjb2mwjkid0u8t
[IntentParser] Using AI for detailed intent parsing
[ChatWorker] Grok: Waiting for early pre-fetch to complete
[ChatWorker] Task cmk57eesf00klb2mwq2qenjnu failed: Error: Grok API error: Missing Bearer token
    at ChatWorker.processGrokTask (file:///app/dist/jobs/chatWorker.js:1733:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async ChatWorker.runTask (file:///app/dist/jobs/chatWorker.js:211:17)
INFO:     100.64.0.7:52044 - "POST /moderation/input HTTP/1.1" 200 OK
INFO:     100.64.0.3:34996 - "POST /grok/v1/chat/completions HTTP/1.1" 401 Unauthorized
incoming request
[DEBUG] onRequest: GET /api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWs1Nm9sNXcwMnFkbDUwY2ZjNnE5eTJ3IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njc4NjA4MTIsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21rM3ViZ3JhMDB4M2w1MGMwNXpycWJ6eSIsImV4cCI6MTc2Nzg2NDQxMn0.Zcm1x54dT_2SpVO3aR2rF-Z6Dnmpc0BfbOKB_oK2jlWyiAJIDlv68V0BtNNgS8aLIQKwND_tuM_YHd8Mvytv5w
[ChatWS] Client connected for user did:privy:cmk3ubgra00x3l50c05zrqbzy. Total connections for user: 1