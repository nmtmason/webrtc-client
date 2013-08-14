# webrtc-client

A light wrapper around the WebRTC API.
For an example server implementation see [webrtc-handler](http://github.com/nmtmason/webrtc-handler).

``` js
var webrtc = require('webrtc-client')

getUserMedia({ audio: true, video: true }, function (stream) {
  var video = document.querySelector('video')

  var url = 'ws://localhost:8000'
  var client = webrtc({ url: url, stream: stream })
  client.on('stream add', function (remote, id) {
    video.src = window.URL.createObjectURL(remote);
  })
  client.on('stream remove', function (remote, id) {
    video.src = null
  })
  client.connect()
})
```

# Methods

``` js
var webrtc = require('webrtc-client')
```

## var client = webrtc(options)

Returns a webrtc-client instance.

### options.url
Websocket url of the signalling server.
### options.stream
Local stream to be sent to connected peers.
### options.debug
Log messages to the console.

## client.connect(obj={})

Create a connection to the signalling server using the url given when the client was created.
The client will connect to peers advertised by the server through the `peers` event.

The supplied `obj` will be sent to the signalling server with a `join` message.
This could contain application specific information for the server such as the room to join.

## client.close()

Close connection to the signalling server and any connected peers.

## Other methods
### client.mute()
### client.unmute()
### client.pause()
### client.play()

# Events

## client.on('stream add', cb)

Fires when a new stream is received. `cb` takes two arguments:
* `stream` - The remote stream received.
* `id` - The id of the associated peer.

## client.on('stream remove', cb)

Fires when a stream is removed. `cb` takes two arguments:
* `stream` - The remote stream removed.
* `id` - The id of the associated peer.

## Other events
### client.on('peers', cb)
### client.on('leave', cb)
### client.on('join', cb)
### client.on('mute', cb)
### client.on('unmute', cb)
### client.on('pause', cb)
### client.on('play', cb)

