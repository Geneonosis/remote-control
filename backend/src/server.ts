import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import { WebSocketServer, WebSocket } from "ws";

import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

// ----- ENVIRONMENT VARIABLES -----

const PORT = Number(process.env.PORT || 3001);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not defined in environment variables");
}

const VALID_AGENT_TOKENS: Record<string, string> = {
  "desktop-1": process.env.AGENT_TOKEN_DESKTOP_1 || "",
};

// ----- GOOGLE OAUTH CLIENT -----
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ----- TYPES -----
type AuthedUser = {
  email: string;
  sub: string;
};

type CommandOption = {
  id: string;
  label: string;
};

// ----- In-Memory Data -----
const COMMANDS: CommandOption[] = [
  { id: "open-notepad", label: "Open Notepad" },
  { id: "restart-app-x", label: "Restart App X" },
];

// Policy: which Google email can run which commands on which agents
const POLICY: Record<string, Record<string, string[]>> = {
  "genetigner.art@gmail.com": {
    "desktop-1": ["open-notepad", "restart-app-x"],
  },
  "jarriaga18@gmail.com": {
    "desktop-1": ["open-notepad"],
  },
  // Add more users/firends here
  // "friend@gmail.com": {"desktop-1": ["open-notepad"]},
};

// Registry of connected agents
const agents = new Map<string, WebSocket>();

// ----- Express App -----
const app = express();
app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// List Available Commands
app.get("/options", (req, res) => {
  res.json(COMMANDS);
});

// Auth middleware: verify google id token from authorization header
async function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const idToken = header.substring("Bearer ".length).trim();
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: "Invalid ID token payload" });
    }

    (req as any).user = {
      email: payload.email,
      sub: payload.sub,
    } as AuthedUser;

    next();
  } catch (error) {
    console.error("Error verifying ID token:", error);
    return res.status(401).json({ error: "Invalid ID token" });
  }
}

// Check if a user is allowed to run a command on an agent
function isCommandAllowed(
  email: string,
  agentId: string,
  commandId: string
): boolean {
  const userPolicy = POLICY[email.toLowerCase()];
  if (!userPolicy) return false;

  const allowedCommands = userPolicy[agentId];
  if (!Array.isArray(allowedCommands)) return false;
  return allowedCommands.includes(commandId);
}

// POST /select: user chooses command + agent
app.post("/select", authMiddleware, (req, res) => {
  const user = (req as any).user as AuthedUser;
  const { agentId, optionId: commandId } = req.body as {
    agentId: string;
    optionId: string;
  };

  if (!agentId || !commandId) {
    return res.status(400).json({ error: "Missing agentId or optionId" });
  }

  const commandDef = COMMANDS.find((c) => c.id === commandId);
  if (!commandDef) {
    return res.status(400).json({ error: "Invalid optionId" });
  }

  if (!isCommandAllowed(user.email, agentId, commandId)) {
    console.warn(
      `User ${user.email} is not allowed to run command ${commandId} on agent ${agentId}`
    );
    return res
      .status(403)
      .json({ error: "Not allowed to run this command on the selected agent" });
  }

  const ws = agents.get(agentId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: "Agent not connected" });
  }

  const requestId = crypto.randomUUID();
  const msg = {
    type: "RUN",
    requestId,
    commandId,
  };

  ws.send(JSON.stringify(msg));

  return res.json({ status: "Command sent to agent", requestId });
});

// ----- HTTP & WebSocket Server -----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/agent" });

wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const agentId = url.searchParams.get("agentId") || "";
    const authHeader = req.headers["authorization"] || "";

    if (!agentId) {
      console.log("Agent connection without agentId, closing.");
      ws.close();
      return;
    }

    if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
      console.log(`Agent ${agentId} missing Authorization header, closing.`);
      ws.close();
      return;
    }

    const suppliedToken = authHeader.toString().substring("Bearer ".length);
    const expectedToken = VALID_AGENT_TOKENS[agentId];

    if (!expectedToken || suppliedToken !== expectedToken) {
      console.log(`Agent ${agentId} provided invalid token, closing.`);
      ws.close();
      return;
    }

    console.log(`Agent ${agentId} connected.`);
    agents.set(agentId, ws);

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "RESULT") {
          console.log(`Result from ${agentId}: `, message);
        } else {
          console.log(`Message from ${agentId}: `, message);
        }
      } catch (error) {
        console.error(`Invalid message from agent:`, error);
      }
    });

    ws.on("close", () => {
      console.log(`Agent ${agentId} disconnected.`);
      agents.delete(agentId);
    });
  } catch (error) {
    console.error("Error in WebSocket connection handler:", error);
    ws.close();
  }
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint at ws://localhost:${PORT}/agent`);
});
