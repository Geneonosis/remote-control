"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

type CommandOption = {
  id: string;
  label: string;
};

type UserInfo = {
  email: string;
  name?: string;
}

export default function HomePage() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [commands, setCommands] = useState<CommandOption[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  function handleGoogleCredentailResponse(response: any) {
    const token = response.credential as string;
    setIdToken(token);

    // Decode payload just for displaying who is logged in (DO NOT use this instead of backend validation)
    try {
      const payload = JSON.parse(atob(token.split(".")[1])) as UserInfo;
      setUser({ email: payload.email, name: payload.name });
    } catch (error) {
      console.error("Failed to decode ID token payload", error);
    }
  }

  // Initialize Google Identity Services after script loads
  const handleGoogleScriptLoad = () => {
    // if window.google is not defined or GOOGLE_CLIENT_ID is missing, do nothing
    if (!window.google || !GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentailResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render a Google Sign-In button into this div
    window.google.accounts.id.renderButton(
      document.getElementById("google-signin-div"),
      {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      }
    );
  };

  useEffect(() => {
    if (!idToken) return;

    const loadCommands = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/options`);
        if (!res.ok) throw new Error(`Options error: ${res.status}`);
        const data: CommandOption[] = await res.json();
        setCommands(data);
        if (data.length > 0) {
          setSelectedCommand(data[0].id);
        }
      } catch (error: any) {
        console.error(`Failed to load commands: ${error.message ?? String(error)}`);
      }
    }
    loadCommands();
  }, [idToken]);

  // Fire a command
  const handleRunCommand = async () => {
    if (!idToken) {
      setStatus("You must sign in first.");
      return;
    }
    if (!agentId) {
      setStatus("Please enter an Agent ID.");
      return;
    }
    if (!selectedCommand) {
      setStatus("Please select a command.");
      return;
    }
    setStatus("Sending command...");

    try {
      const res = await fetch(`${API_BASE_URL}/select`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          agentId,
          optionId: selectedCommand,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      setStatus(`Queued command. requestId=${data.requestId}`);
    } catch (error: any) {
      console.error("Command error:", error);
      setStatus(`Error: ${error.message ?? String(error)}`);
    }
  };

  return (
    <>
      {/* Google script */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={handleGoogleScriptLoad}
      />
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md border rounded-lg p-6 shadow-sm">
          <h1 className="text-2xl font-semibold mb-4">Remote Command Panel</h1>
          {!idToken ? (
            <>
              <p className="mb-4">Sign in with Google to access the control panel.</p>
              <div id="google-signin-div" />
            </>
          ) : (
            <>
              <div className="mb-4 text-sm">
                <p className="font-medium">Signed in as:</p>
                <p>
                  {user?.name && <span>{user.name} - </span>}
                  <span>{user?.email}</span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Agent ID {agentId}</label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="e.g. desktop-1"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Command</label>
                {commands.length === 0 ? (
                  <p className="text-sm text-gray-500">No commands loaded. Check backend /options.</p>
                ) : (
                  <select value={selectedCommand} onChange={(e) => setSelectedCommand(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                    {commands.map((cmd) => (
                      <option key={cmd.id} value={cmd.id}>
                        {cmd.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                onClick={handleRunCommand}
                className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition-colors"
              >
                Run Command
              </button>
            </>
          )}

          {status && (
            <div className="mt-4 p-2 bg-gray-100 border rounded text-sm">
              {status}
            </div>
          )}
        </div>
      </main>
    </>
  )
}