//@ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Video from '@/components/Video/Video';
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa6";
import { IoSend } from "react-icons/io5";
import { TbShare2 } from "react-icons/tb";
import { Button } from '@/components/ui/button';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { Producer } from "mediasoup-client/lib/types";
import { Input } from '@/components/ui/input';
import StudioModal from '@/components/StudioModal/StudioModal';

let codec_params = {
  // mediasoup params
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
}

let device:any;
let producerTransport:any;
let consumerTransports:any = [];
let consumingTransports:any = [];
let screenProducerInstance:Producer;
let videoProducerInstance:Producer;
let audioProducerInstance:Producer;
let isAdmin:any;
let isAdminReceived:any;
let currentRow = 0;
let currentCol = 0;
const Studio = () => {
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [videoText , setVideoText] = useState<boolean>(false);
  const [micText, setMicText] = useState<boolean>(false);
  const VIDEO_BUTTON_TEXT : JSX.Element = videoText ? <FaVideoSlash size='23'/> : <FaVideo size='20'/>;
  const MIC_BUTTON_TEXT : JSX.Element = micText ? <FaMicrophoneSlash size='24'/> : <FaMicrophone size='20'/>;
  const SCREEN_SHARE_BUTTON_TEXT : JSX.Element = <TbShare2 size='25'/>;
  //
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState<boolean>(false);
  const GO_LIVE_TEXT : string = live ? "End Live" : "Go Live";
  const [socket, setSocket] = useState(io("http://localhost:5001",{transports: ['websocket'],upgrade: false,}));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const height = 300;
  const width = 700;
  const roomName = useParams().studioId;
  let rtpCapabilities:any;
  let audioParams:any;
  let videoParams = { codec_params };
  console.log("Loaded");
  // const socket = useMemo(() =>
  //     io('http://localhost:5001', {
  //       transports: ['websocket'],
  //       upgrade: false,
  //     }),
  //   []
  // );
  
  useEffect(() => {
    const startUserMediaStream = async () => {
      try {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        setUserStream(userMediaStream);
        const videoRefCurrent = userVideoRef.current;
        if (videoRefCurrent) {
          videoRefCurrent.srcObject = userMediaStream;
        }
      } catch (error) {
        console.error('Error accessing user media:', error);
      }
    };

    startUserMediaStream();

    // Clean up the user media stream when the component unmounts
    return () => {
      if (userStream) {
        userStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); 

  const toggleVideo = () => {
    if (userStream) {
      const videoTrack = userStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setVideoText(prev => !prev);
    }
  };

  const toggleAudio = () => {
    if (userStream) {
      const audioTrack = userStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setMicText(prev => !prev);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        setScreenShareStream(screenShareStream);
        const screenShareRef = screenShareVideoRef.current;
        if (screenShareRef) {
          screenShareRef.srcObject = screenShareStream;
        }
        setIsScreenSharing(true);
        const screenParam = { track: screenShareStream?.getVideoTracks()[0],...videoParams };
        screenProducerInstance = await producerTransport.produce(screenParam);
        console.log(`SPI: ${screenProducerInstance.id}`)
        console.log(`ID: ${screenProducerInstance.localId}`)
      } catch (error) {
        console.error('Error accessing screen share:', error);
      }
    } else {
      const tracks = screenShareStream?.getTracks();
      tracks?.forEach((track) => track.stop());
      setScreenShareStream(null);
      setIsScreenSharing(false);      
      socket.emit('stopScreenShare', screenProducerInstance.id);
    }
  };

  useEffect(() => {
    const observerCallback = () => {
      console.log('Element added to videoContainer');
      // Call the drawOnCanvas function here
      requestAnimationFrame(drawOnCanvas);
  };

  // Create a new MutationObserver instance
    const observer = new MutationObserver(observerCallback);

  // Start observing changes to the videoContainer
    observer.observe(videoContainerRef.current, { childList: true });
    const drawOnCanvas = () => {
      const ctx = canvasRef.current?.getContext('2d');
      const videos = videoContainerRef.current?.querySelectorAll('video');
      const userVideo = userVideoRef.current;
      const screenShareVideo = isScreenSharing && screenShareVideoRef.current;
      
      if (ctx) {
        
            ctx.fillStyle = 'red';
            ctx.clearRect(0, 0, width, height); // Clear the canvas before redrawing
            // Define the number of columns and rows for the 3x3 grid
            const numColumns = 3;
            const numRows = 3;

            // Calculate the width and height of each cell in the grid
            const cellWidth = width / numColumns;
            const cellHeight = height / numRows;

            // Initialize variables to keep track of the current cell position
            let currentCol = 0;
            let currentRow = 0;

            // Draw the user video (if available)
            if (userVideo) {
                const videoWidth = 200;
                const videoHeight = 150;
                const userX = currentCol * cellWidth;
                const userY = currentRow * cellHeight;
                ctx.drawImage(userVideo, userX, userY, videoWidth, videoHeight);
                currentCol++;
                if (currentCol === numColumns) {
                    currentCol = 0;
                    currentRow++;
                }
            }

            // Draw the screen share video (if active)
            if (screenShareVideo) {
                const { videoWidth, videoHeight } = screenShareVideo;
                const screenScale = Math.min(cellWidth / videoWidth, cellHeight / videoHeight);
                const screenX = currentCol * cellWidth;
                const screenY = currentRow * cellHeight;
                ctx.drawImage(screenShareVideo, screenX, screenY, videoWidth * screenScale, videoHeight * screenScale);
                currentCol++;
                if (currentCol === numColumns) {
                    currentCol = 0;
                    currentRow++;
                }
            }

            // Draw the other videos from the video elements
            videos?.forEach((videoElement: any) => {
                const videoWidth = 200;
                const videoHeight = 150;
    
                const x = currentCol * cellWidth;
                const y = currentRow * cellHeight;
                ctx.drawImage(videoElement, x, y, videoWidth, videoHeight);

                currentCol++;
                if (currentCol === numColumns) {
                    currentCol = 0;
                    currentRow++;
                }
            });
        }

        requestAnimationFrame(drawOnCanvas); // Continue drawing on the canvas
        
    };

    requestAnimationFrame(drawOnCanvas); // Start drawing on the canvas
    return () => {
      observer.disconnect();
  };
}, [userVideoRef, isScreenSharing, screenShareVideoRef,videoContainerRef]);  

  const screenStop = () =>{
    console.log("STOP");
    socket.emit('stopScreenShare', screenProducerInstance.id);
  }

  const handleLive = () => {
    setLive((live) => !live);
    if (!live) {
      createSendTransport();
    }
    // if(isAdmin){
    //   recorderInit();
    // }
  };
  
  const recorderInit = () => {
    
    if (canvasRef.current) {
      //@ts-ignore
      //const liveStream = (userVideoRef.current as any).captureStream(30);
      //const liveStream = (screenShareVideoRef.current as any).captureStream(30);
      const liveStream = (canvasRef.current as any).captureStream(30); 
      const audioStream = userStream?.getAudioTracks()[0];
      const liveStreamTrack = liveStream.getVideoTracks()[0];

      const merge = new MediaStream([
        liveStreamTrack,
        audioStream,
      ])
      let mediaRecorder = new MediaRecorder(merge, {
        mimeType: 'video/webm;codecs=h264',
        videoBitsPerSecond: 3 * 1024 * 1024,
      });

      console.log(mediaRecorder, mediaRecorder.ondataavailable);
      mediaRecorder.ondataavailable = (e: any) => {
          console.log('sending chunks', e.data, socket);
          socket.send(e.data);
      };
      mediaRecorder.start(1000);
    } else {
      console.error('Canvas stream is not available');
    }
  };
  
  useMemo(() => {
    socket.emit('joinRoom', { roomName: roomName }, (data: any) => {
          rtpCapabilities = data.rtpCapabilities;
          if (!isAdminReceived && data.isAdmin) {
            isAdmin = true;
            isAdminReceived = true; // Set the flag to true after receiving the value for the first time
          }
          console.log("admin",isAdmin);
          createDevice();
        });
        
        const createDevice = async () => {
          try {
            const deviceInstance = new mediasoupClient.Device();
            await deviceInstance.load({
              routerRtpCapabilities: rtpCapabilities,
            });
            device = deviceInstance;
          } catch (error) {
            console.log(error);
            if (error.name === 'UnsupportedError') {
                console.warn('browser not supported');
              }
            }
        };
      }, [roomName]); // Run once on mount
      

  const createSendTransport = () => {
    socket.emit('createWebRtcTransport', { consumer: false }, ({ params }: any) => {
      if (params.error) {
        console.log(params.error);
        return;
      }

      console.log(params);

      const producerTransportInstance = device.createSendTransport(params);
      producerTransport = producerTransportInstance;

      producerTransportInstance.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          await socket.emit('transport-connect', {
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      producerTransportInstance.on('produce', async (parameters: any, callback: any, errback: any) => {
        console.log(parameters);

        try {
          await socket.emit('transport-produce', {
            kind: parameters.kind,
            rtpParameters: parameters.rtpParameters,
            appData: parameters.appData,
          }, ({ id, producersExist }: any) => {
            callback({ id });

            if (producersExist) getProducers();
          });
        } catch (error) {
          errback(error);
        }
      });

      connectSendTransport(producerTransportInstance);
    });
  };

    const connectSendTransport = async (producer:any) => {
      const producerTransports = producerTransport? producerTransport : producer;
      const audioParam = { track: userStream?.getAudioTracks()[0],...audioParams };
      const videoParam = { track: userStream?.getVideoTracks()[0],...videoParams };
      audioProducerInstance = await producerTransports.produce(audioParam);
      videoProducerInstance = await producerTransports.produce(videoParam);
    };


  const transport = () =>{
    socket.emit('get-transport',(transports:any)=>{
      console.log(`Transports: ${JSON.stringify(transports)}`);
    })
    recorderInit();
  }  
  const signalNewConsumerTransport = async (remoteProducerId: any) => {
    if (consumingTransports.includes(remoteProducerId)) return;
    consumingTransports = [...consumingTransports, remoteProducerId];

    await socket.emit('createWebRtcTransport', { consumer: true }, ({ params }: any) => {
      if (params.error) {
        console.log(params.error);
        return;
      }
      let consumerTransport;
      try {
        consumerTransport = device.createRecvTransport(params);
      } catch (error) {
        console.log(error);
        return;
      }

      consumerTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          await socket.emit('transport-recv-connect', {
            dtlsParameters,
            serverConsumerTransportId: params.id,
          });
          callback();
        } catch (error) {
          errback(error);
        } 
      });
      
      connectRecvTransport(consumerTransport, remoteProducerId, params.id);
    });
  };

  socket.on('new-producer', ({ producerId }) => signalNewConsumerTransport(producerId));

  const getProducers = () => {
    socket.emit('getProducers', (producerIds:any) => {
      console.log('prodID:', producerIds);
      producerIds.forEach(signalNewConsumerTransport);
    });
  };

  const connectRecvTransport = async (consumerTransport: any, remoteProducerId: any, serverConsumerTransportId: any) => {
    await socket.emit('consume', {
      rtpCapabilities: device.rtpCapabilities,
      remoteProducerId,
      serverConsumerTransportId,
    }, async ({ params }: any) => {
      if (params.error) {
        console.log('Cannot Consume');
        return;
      } 
      const consumer = await consumerTransport.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
      });

      consumerTransports = [
        ...consumerTransports,
        {
          consumerTransport,
          serverConsumerTransportId: params.id,
          producerId: remoteProducerId,
          consumer,
        },
      ];

      const newElem = document.createElement('div');
      newElem.setAttribute('id', `rid-${remoteProducerId}`);
      if (params.kind === 'audio') {
        newElem.setAttribute('class', 'hidden');
        newElem.innerHTML = '<audio id="' + remoteProducerId + '" autoplay></audio>';
      } else {
        newElem.innerHTML = '<video id="' + remoteProducerId + '" autoplay class="w-[250px] h-[150px] bg-black p-1 m-1"></video>';
      }
      videoContainer.appendChild(newElem);
      
      const { track } = consumer;
      
      document.getElementById(remoteProducerId).srcObject = new MediaStream([track]);
      socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });

    });
  };

  socket.on('producer-closed', ({ remoteProducerId }) => {
  
    const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
    console.log("toClose:",producerToClose);
    producerToClose.consumerTransport.close()
    producerToClose.consumer.close()

    // remove the consumer transport from the list
    consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)

    // remove the video div element
    videoContainer.removeChild(document.getElementById(`rid-${remoteProducerId}`))
  });


  return (
    <>
     {/* <StudioModal/> */}
      <div className="flex h-screen">
        <div className="w-4/6 p-4 bg-secondary flex flex-col justify-evenly">
          <div className="flex gap-3 justify-center">
            <Video className="w-[250px] h-[150px] bg-black p-1 m-1" videoRef={userVideoRef} />
            <Video className={`w-[250px] h-[150px] ${!isScreenSharing ? "hidden" : ""}`} videoRef={screenShareVideoRef} />
          </div>
          {isAdmin?
            <canvas ref={canvasRef} width= {width} height={height} /> : <div></div> }
          <div id="videoContainer" ref={videoContainerRef} className={`grid grid-cols-4 justify-start mt-4 ${isAdmin ? "hidden" : ""}`}></div>
          {/*<div className="border border-lime-500 p-10"></div>*/}
          <div className='flex items-center justify-center gap-2'>
            <Button onClick={toggleAudio} className={`w-16 h-16 p-3 rounded-full ${micText && ('bg-red-700 hover:bg-red-800')}`}>
              {MIC_BUTTON_TEXT}
            </Button>
            <Button onClick={toggleVideo} className={`w-16 h-16 p-3 rounded-full ${videoText && ('bg-red-700 hover:bg-red-800')}`}>
              {VIDEO_BUTTON_TEXT}
            </Button>
            <Button onClick={toggleScreenShare} className={`w-16 h-16 p-3 rounded-full ${isScreenSharing && ('bg-blue-500 hover:bg-blue-600')}`}>
              {SCREEN_SHARE_BUTTON_TEXT}
            </Button>
          </div>
        </div>
        <div className="w-2/6 p-2 h-full">
          <div className="flex items-center justify-center gap-2 py-4">
            <Button onClick={handleLive}>{GO_LIVE_TEXT}</Button>
            <Button onClick={transport}>GET TRANSPORT</Button>
            <Button onClick={screenStop}>STOP</Button>
          </div>
          <div className="border flex flex-col">
            <h3 className='text-2xl font-semibold tracking-tight p-2'>Live Chat</h3>
            <div className='bg-slate-200 h-[500px]'>
              <p>Chats section</p>
            </div>
            <div className='flex gap-2 px-3 py-4'>
              <Input />
              <Button>
                <IoSend size='15' />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Studio;
