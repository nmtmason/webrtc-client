var util = require('util')
var EventEmitter = require('events').EventEmitter
var smerge = require('smerge')

var RTCPeerConnection =
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.RTCPeerConnection;
var RTCSessionDescription =
  window.mozRTCSessionDescription ||
  window.RTCSessionDescription;
var RTCIceCandidate =
  window.mozRTCIceCandidate ||
  window.RTCIceCandidate;

function Client(options) {
  if (!(this instanceof Client)) {
    return new Client(options)
  }
  this.url = options.url
  this.debug = options.debug
  this.stream = options.stream
  this.audio = this.video = true
  this.muted = this.paused = false
  this.peerConnections = {}
  var url = navigator.mozGetUserMedia ?
    'stun:23.21.150.121' : 'stun:stun.l.google.com:19302'
  this.servers = { 'iceServers': [{ url: url }] }
  EventEmitter.call(this)
  return this
}
util.inherits(Client, EventEmitter)

Client.prototype.connect = function (obj) {
  var self = this
  this.socket = new WebSocket(this.url)
  this.socket.onopen = function () {
    self.send(smerge(obj, { type: 'join' }))
  }
  this.socket.onmessage = function (message) {
    var message
    try {
      message = JSON.parse(message.data)
    } catch (err) {
      self.emit('error', err)
      return;
    }
    if (self.debug) {
      console.log(message.type)
      console.log(message)
    }
    self.emit(message.type, message);
  }
  this.socket.onerror = function (err) {
    self.emit('error', err)
  }
  this.socket.onclose = function () {
    self.close()
  }

  this.on('peers', function (message) {
    var peers = message.peers
    for (var i = 0; i < peers.length; i += 1) {
      var id = peers[i]
      var pc = self.createPeerConnection(id)
      pc.addStream(self.stream)
      self.sendOffer(id)
      self.peerConnections[id] = pc
    }
  })
  this.on('join', function (message) {
    var pc = self.createPeerConnection(message.id)
    pc.addStream(self.stream)
  })
  this.on('offer', function (message) {
    self.receiveOffer(message.id, message)
  })
  this.on('answer', function (message) {
    self.receiveAnswer(message.id, message)
  })
  this.on('candidate', function (message) {
    self.receiveCandidate(message.id, message)
  })
  this.on('leave', function (message) {
    self.destroyPeerConnection(message.id)
  })
  return this
}

Client.prototype.close = function () {
  for (var id in this.peerConnections) {
    if (this.peerConnections.hasOwnProperty(id)) {
      this.destroyPeerConnection(id)
    }
  }
  this.socket.close()
  this.emit('close')
}

Client.prototype.createPeerConnection = function (id) {
  var self = this
  // http://www.webrtc.org/interop
  // Constraints / configurations issues.
  var constraints = {
    optional: [{ DtlsSrtpKeyAgreement: true }]
  }
  var pc = new RTCPeerConnection(this.servers, constraints);
  pc.onicecandidate = function (event) {
    var candidate = event.candidate
    if (event.candidate) {
      self.send({
        type: 'candidate',
        id: id,
        sdpMLineIndex: candidate.sdpMLineIndex,
        candidate: candidate.candidate
      })
    }
  }
  pc.oniceconnectionstatechange = function (event) {
    var target = event.target
    if (target.iceConnectionState === 'closed') {
      self.destroyPeerConnection(id)
    }
  }
  pc.onaddstream = function (event) {
    pc.stream = event.stream
    self.emit('stream add', event.stream, id)
  }
  pc.onremovestream = function (event) {
    pc.stream = null
    self.emit('stream remove', event.stream, id)
  }
  this.peerConnections[id] = pc
  return pc;
}

Client.prototype.destroyPeerConnection = function (id) {
  var pc = this.peerConnections[id]
  if (pc) {
    pc.close()
    delete this.peerConnections[id]
    this.emit('stream remove', pc.stream, id)
  }
}

Client.prototype.sendOffer = function (id) {
  var self = this
  var pc = this.peerConnections[id]
  var constraints = {
    optional: [],
    mandatory: {
      OfferToReceiveAudio: this.audio,
      OfferToReceiveVideo: this.video,
      MozDontOfferDataChannel: true
    }
  }
  if (!navigator.mozGetUserMedia) {
    delete constraints.mandatory['MozDontOfferDataChannel']
  }
  pc.createOffer(function (description) {
    pc.setLocalDescription(description)
    self.send(smerge(description, { id: id }))
  }, null, constraints)
}

Client.prototype.receiveOffer = function (id, message) {
  var self = this
  var pc = this.peerConnections[id]
  pc.setRemoteDescription(new RTCSessionDescription(message));
  pc.createAnswer(function (description) {
    pc.setLocalDescription(description)
    self.send(smerge(description, { id: id }))
  })
}

Client.prototype.receiveAnswer = function (id, message) {
  var pc = this.peerConnections[id]
  pc.setRemoteDescription(new RTCSessionDescription(message));
}

Client.prototype.receiveCandidate = function (id, message) {
  var pc = this.peerConnections[id]
  pc.addIceCandidate(new RTCIceCandidate(message));
}

Client.prototype.mute = function () {
  this.toggle(this.stream.getAudioTracks(), false)
  this.muted = true
}

Client.prototype.unmute = function () {
  this.toggle(this.stream.getAudioTracks(), true)
  this.muted = false
}

Client.prototype.pause = function () {
  this.toggle(this.stream.getVideoTracks(), false)
  this.paused = true
}

Client.prototype.play = function () {
  this.toggle(this.stream.getVideoTracks(), true)
  this.paused = false
}

Client.prototype.toggle = function (tracks, enabled) {
  for (var i = 0; i < tracks.length; i += 1) {
    tracks[i].enabled = enabled
  }
}

Client.prototype.send = function (message) {
  this.socket.send(JSON.stringify(message))
}

module.exports = Client

