/**
 * WebRTC Signaling server for 1:1 communication
 */

import { RawData, WebSocket, WebSocketServer } from "ws";
import { WSType, WsMsg } from "./types";

const wsServer = new WebSocketServer({ port: 8080 });

interface VSReceiver {
  websocket: WebSocket,
  id: string,
}

let vsReceivers: VSReceiver[] = [];

let vsSender: WebSocket | undefined = undefined;

wsServer.on('connection', (ws: WebSocket) => {
  
  ws.on('open', () => {
    console.log('new client connected')
  })

  ws.on('close', () => {
    console.log('client was closed')
    if (vsSender === ws) {
      vsSender = undefined
      console.log("stream sender was disconnected")
    }
    vsReceivers.forEach(vsReceiver => {      
      if (vsReceiver.websocket === ws) {
        vsReceivers = vsReceivers.filter((vsReceiver) => vsReceiver.websocket !== ws)
        console.log("stream receiver was disconnected")
      }
    });
  })
  
  ws.on('message', (msg: RawData) => {
    try {
      const data: WsMsg = JSON.parse(msg.toString())
      console.log("data", data)
      
      if (data.Sender) {

        // Video Stream sender handler
        switch (data.WSType) {
          case WSType.CONNECTED:
            if (vsSender === undefined) {
              vsSender = ws
            } else  {
              sendWsMsg(ws, newWsMsg({WSType: WSType.CONNECTED, Data: "double streamer"}))
            }
            break
          case WSType.SDP:
            console.log("Sender SDP received", data.SDP) 
            // Check if video stream receiver was registered
            const id = data.ID || ""
            const vsReceiver = vsReceivers.find((v) => v.id === id)
            if (vsReceiver === undefined) {
              console.log("requested receiver was disconnected", id)
            } else {
              // Send video stream sender's SDP to receiver immediately
              sendWsMsg(vsReceiver.websocket, { WSType: WSType.SDP, SDP: data.SDP })
              console.log("sent SDP to vsReceiver immediately", data.SDP)
            }
            break
        }

      } else {
        switch (data.WSType) {
          case WSType.CONNECTED:
            // Check if vsSender was already registered
            const tmp = vsReceivers.find((v) => v.websocket === ws)
            if (tmp === undefined) {
              vsReceivers.push({
                websocket: ws,
                id: genID(),
              })
            }
            if (vsSender !== undefined) {
              sendWsMsg(ws, {WSType: WSType.CONNECTED, Data: "available"})
            } else {
              sendWsMsg(ws, {WSType: WSType.CONNECTED, Data: "not available"})
            }
            break;
          
          case WSType.SDP:
            console.log("Receiver SDP received", data.SDP)
            if (vsSender === undefined) {
              sendWsMsg(ws, {WSType: WSType.CONNECTED, Data: "not available"})
            } else {
              var vsReceiver: VSReceiver | undefined
              vsReceiver = vsReceivers.find((v) => v.websocket === ws)
              if (vsReceiver === undefined) {
                console.log("requested receiver was disconnected",)
                vsReceiver = {
                  websocket: ws,
                  id: genID()
                }
                vsReceivers.push(vsReceiver)
              }

              sendWsMsg(vsSender, {
                WSType: WSType.SDP,
                SDP: data.SDP,
                ID: vsReceiver.id
              })
              console.log("SDP was to vsSender from ", vsReceiver.id)
            }
            break
          default:
            break;
        }

      }      
    } catch (error) {
      console.error(error)
    }
  })

})

const genID = (): string => {
  const now = new Date();
  const utcString = now.toISOString();
  return utcString;
}

const newWsMsg = ({
  Sender,
  WSType,
  SDP,
  ICE,
  Answer,
  Data
}: {
  Sender?: boolean,
  WSType: string,
  SDP?: string,
  ICE?: RTCIceCandidateInit,
  Answer?: string,
  Data?: string
}) => {
  const data: WsMsg = {
    Sender: Sender,
    WSType: WSType,
    SDP: SDP,
    ICE: ICE,
    Answer: Answer,
    Data: Data
  }
  return data
}

const sendWsMsg = (ws: WebSocket, msg: WsMsg) => {
  ws.send(JSON.stringify(msg))
}