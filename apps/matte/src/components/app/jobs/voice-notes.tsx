"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface VoiceNotesProps {
  onTranscript: (text: string) => void;
}

// Extend Window interface for webkit speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceNotes({ onTranscript }: VoiceNotesProps) {
  const { addToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      transcriptRef.current = "";
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update the transcript
      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
        onTranscript(transcriptRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        addToast("Microphone access denied. Please enable in browser settings.", "error");
      } else if (event.error === 'no-speech') {
        // Ignore no-speech error, just stop
        recognition.stop();
      } else if (event.error !== 'aborted') {
        addToast(`Speech recognition error: ${event.error}`, "error");
      }
      
      setIsListening(false);
    };

    recognition.onend = () => {
      // Save whatever was captured
      if (transcriptRef.current) {
        onTranscript(transcriptRef.current);
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, addToast]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        transcriptRef.current = "";
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        addToast("Failed to start voice recording", "error");
      }
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "default" : "outline"}
      size="sm"
      onClick={toggleRecording}
      className={cn(
        "touch-target min-h-[44px] min-w-[44px]",
        isListening && "bg-red-500 hover:bg-red-600 text-white"
      )}
      title={isListening ? "Stop recording" : "Start voice recording"}
    >
      {isListening ? (
        <MicOff className={cn("h-4 w-4", isListening && "animate-pulse")} />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
