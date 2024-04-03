const config = {
  recorder: {
    minPort: 20000,
    maxPort: 30000,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        prefferedPayloadType: 111,
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        prefferedPayloadType: 96,
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ]
  },
    plainRtpTransport: {
      listenIp: { ip: '0.0.0.0', announcedIp: '127.0.0.1' }, // TODO: Change announcedIp to your external IP or domain name
      rtcpMux: false,
      comedia: false
    },
    webRtc: {
      listenIps: [ { ip: '0.0.0.0', announcedIp: '127.0.0.1' } ], // TODO: Change announcedIp to your external IP or domain name
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      maxIncomingBitrate: 1500000
    },
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 19999
  },
};

export default config