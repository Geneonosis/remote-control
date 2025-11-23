import "dotenv/config";
import WebSocket from "ws";
import { exec } from "child_process";

const BACKEND_WS_URL =
  process.env.BACKEND_WS_URL || "ws://localhost:3001/agent";
const AGENT_ID = process.env.AGENT_ID;
const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!BACKEND_WS_URL) {
  throw new Error("BACKEND_WS_URL is not defined in .env");
}

if (!AGENT_ID) {
  throw new Error("AGENT_ID is not defined in .env");
}

if (!AGENT_TOKEN) {
  throw new Error("AGENT_TOKEN is not defined in .env");
}

const COMMAND_MAP: Record<string, string> = {
  "open-notepad": "notepad.exe",
};

type RunMessage = {
  type: "RUN";
  requestId: string;
  commandId: string;
};

type ResultMessage = {
  type: "RESULT";
  requestId: string;
  success: boolean;
  stdout: string;
  stderr: string;
};

function connect() {
  console.log(
    `Connecting to backend websocket at ${BACKEND_WS_URL} as agent ${AGENT_ID}`
  );
  const ws = new WebSocket(
    `${BACKEND_WS_URL}?agentId=${encodeURIComponent(AGENT_ID!)}`,
    { headers: { Authorization: `Bearer ${AGENT_TOKEN}` } }
  );

  ws.on("open", () => {
    console.log("WebSocket connection established");
  });

  ws.on("message", (data) => {
    try {
      const message: RunMessage = JSON.parse(data.toString());

      if (message.type === "RUN") {
        handleRunMessage(ws, message as RunMessage);
      } else {
        console.log("Unknown message type:", message);
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed. Reconnecting in 5 seconds...");
    setTimeout(connect, 5000);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

function handleRunMessage(ws: WebSocket, message: RunMessage) {
  const { requestId, commandId } = message;
  const command = COMMAND_MAP[commandId];

  if (!command) {
    console.warn(`Received unknown commandId: ${commandId}`);
    const result: ResultMessage = {
      type: "RESULT",
      requestId,
      success: false,
      stdout: "",
      stderr: `Unknown commandId: ${commandId}`,
    };
    ws.send(JSON.stringify(result));
    return;
  }

  console.log(`Executing commandId=${commandId} -> (${command})`);

  exec(command, (error, stdout, stderr) => {
    const result: ResultMessage = {
      type: "RESULT",
      requestId,
      success: !error,
      stdout: stdout,
      stderr: stderr || (error ? error.message : ""),
    };

    console.log(
      `Command "${commandId}" executed with success=${result.success}, stdout length=${result.stdout.length}, stderr length=${result.stderr.length}`
    );
    ws.send(JSON.stringify(result));
  });
}

// Start the agent

connect();
