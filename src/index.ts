/**
 * WebRTC Signaling server for 1:1 communication
 */

import { RawData, WebSocket, WebSocketServer } from "ws";
import { WSType, WsMsg } from "./types";

const wsServer = new WebSocketServer({ port: 8080 });

let vsReceiver: WebSocket | undefined = undefined;

let vsSender: WebSocket | undefined = undefined;

let receverSDP: string = ""
let senderSDP: string = ""

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
    if (vsReceiver === ws) {
      vsReceiver = undefined
      console.log("stream receiver was disconnected")
      receverSDP = ""
    }
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
              if (vsReceiver !== undefined && receverSDP !== "") {
                sendWsMsg(vsSender, { WSType: WSType.SDP, SDP: receverSDP })
                console.log("sent SDP to vsSender")
                receverSDP = ""
              }
            } else  {
              sendWsMsg(ws, newWsMsg({WSType: WSType.CONNECTED, Data: "double streamer"}))
            }
            break
          case WSType.SDP:
            console.log("Sender SDP received", data.SDP) 
            // Check if video stream receiver was registered
            if (vsReceiver === undefined) {
              // Save video stream sender's SDP
              senderSDP = data.SDP || ""
            } else {
              // Send video stream sender's SDP to receiver immediately
              sendWsMsg(vsReceiver, { WSType: WSType.SDP, SDP: data.SDP })
              senderSDP = ""
              console.log("sent SDP to vsReceiver immediately", data.SDP)
            }
            break
        }

      } else {
        switch (data.WSType) {
          case WSType.CONNECTED:
            // Check if vsReceiver was already registered
            if (vsReceiver === undefined) {
              vsReceiver = ws
              sendWsMsg(ws, {WSType: WSType.CONNECTED, Data: "available"})
            } else {
              sendWsMsg(ws, {WSType: WSType.CONNECTED, Data: "not available"})
            }
            break;
          
          case WSType.SDP:
            console.log("Receiver SDP received", data.SDP)
            if (vsSender === undefined) {
              receverSDP = data.SDP || ""
            } else {
              sendWsMsg(vsSender, { WSType: WSType.SDP, SDP: data.SDP })
              console.log("sent SDP to vsSender", receverSDP)
              receverSDP = ""
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