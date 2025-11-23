// agent.ts
import "dotenv/config";
import WebSocket from "ws";
import { runCommand, CommandResult, CommandId } from "./agent-core.js"; // adjust path/extension based on your build

type RunMessage = {
  type: "RUN";
  requestId: string;
  commandId: CommandId;
};

type RegisterArkMessage = {
  type: "REGISTERED";
};

type AgentMessageFromServer = RunMessage | RegisterArkMessage;

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

function connect() {
  console.log(`Connecting to backend at ${BACKEND_WS_URL}...`);
  const ws = new WebSocket(BACKEND_WS_URL);

  ws.on("open", () => {
    console.log("WebSocket connected, registering agent...");

    ws.send(
      JSON.stringify({
        type: "REGISTER",
        agentId: AGENT_ID,
        token: AGENT_TOKEN,
      })
    );
  });

  ws.on("message", async (data) => {
    let msg: AgentMessageFromServer;

    try {
      msg = JSON.parse(String(data));
    } catch (err) {
      console.error("Failed to parse message from server:", err);
      return;
    }

    if (msg.type === "RUN") {
      const { requestId, commandId } = msg;

      try {
        const result: CommandResult = await runCommand(commandId, requestId);
        ws.send(JSON.stringify(result));
      } catch (err: any) {
        const errorResult: CommandResult = {
          type: "RESULT",
          requestId,
          commandId,
          success: false,
          stdout: "",
          stderr: err?.message ?? String(err),
        };
        ws.send(JSON.stringify(errorResult));
      }
    }

    // handle other message types (REGISTERED, PING, etc.) as needed
  });

  ws.on("close", (code, reason) => {
    console.warn("WebSocket closed:", code, reason.toString());
    // basic reconnect:
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
}
// Start the agent

connect();
