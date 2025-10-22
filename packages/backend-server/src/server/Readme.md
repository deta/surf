## Current Protocol

This is v0 of the current protocol used for the socket messages.
This is dead simple, naive, and fragile, and tight coupling with the client.
We need to move off to a more robust solution if there we hit issues.

1. Client connects to Unix socket
2. Client sends request type as string (e.g., `"EncodeSentences"`)
3. Server responds with `[ack]\n`
4. Client sends message data in chunks (up to 16KB per read)
5. Client ends with `[done]` suffix
6. Server processes and responds
7. Server ends with `[done]\n`

### Example

```
Client → "EncodeSentences"
Server → "[ack]\n"
Client → "chunk of data..."
Client → "more data...[done]"
Server → "response data..."
Server → "[done]\n"
```
