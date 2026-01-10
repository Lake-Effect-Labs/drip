"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Ask me about your business. Try:\n• \"What's my total revenue?\"\n• \"How many jobs do I have?\"\n• \"What jobs do I have today?\"\n• \"Who hasn't paid me yet?\"\n• \"What materials do I need tomorrow?\"",
};

export function MatteView() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMattePageRef = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset chat when leaving Matte tab (route change)
  useEffect(() => {
    const isMattePage = pathname === "/app/matte";
    
    // If we're leaving the Matte page, reset messages
    if (!isMattePage && isMattePageRef.current) {
      setMessages([INITIAL_MESSAGE]);
    }
    
    isMattePageRef.current = isMattePage;
  }, [pathname]);

  // Reset chat when page becomes hidden (app backgrounded, tab switched, browser minimized)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - reset chat when user comes back if they're not on Matte page
        const handleFocus = () => {
          if (pathname !== "/app/matte") {
            setMessages([INITIAL_MESSAGE]);
          }
          window.removeEventListener("focus", handleFocus);
        };
        window.addEventListener("focus", handleFocus);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  // Cleanup: reset when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Reset on unmount
      setMessages([INITIAL_MESSAGE]);
    };
  }, []);

  // Reset chat when leaving Matte tab
  useEffect(() => {
    const isMattePage = pathname === "/app/matte";
    
    // If we're leaving the Matte page, reset messages
    if (!isMattePage && isMattePageRef.current) {
      setMessages([INITIAL_MESSAGE]);
    }
    
    isMattePageRef.current = isMattePage;
  }, [pathname]);

  // Reset chat when page becomes hidden (app backgrounded, tab switched)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - reset chat when user comes back
        // We'll reset on next focus to avoid clearing while they're still on the page
        const handleFocus = () => {
          if (pathname !== "/app/matte") {
            setMessages([INITIAL_MESSAGE]);
          }
          window.removeEventListener("focus", handleFocus);
        };
        window.addEventListener("focus", handleFocus);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  // Cleanup: reset when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Reset on unmount
      setMessages([INITIAL_MESSAGE]);
    };
  }, []);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/matte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I'm having trouble right now. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-card p-4 shrink-0">
        <h1 className="text-2xl font-bold">Matte</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about your business
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pt-4 space-y-4 min-h-0">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
