import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Upload, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Capture = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const MAX_RECORDING_TIME = 120; // 2 minutes

  useEffect(() => {
    // Read teacher ID and session ID from URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const teacherIdFromQR = searchParams.get('teacher');
    const sessionIdFromQR = searchParams.get('session');

    // Store for later use in Processing
    if (teacherIdFromQR) {
      sessionStorage.setItem('teacherId', teacherIdFromQR);
    }
    if (sessionIdFromQR) {
      sessionStorage.setItem('sessionId', sessionIdFromQR);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      toast.error("Impossible d'accéder au microphone");
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("audio/")) {
        setAudioBlob(file);
        toast.success("Fichier audio chargé");
      } else {
        toast.error("Veuillez sélectionner un fichier audio");
      }
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.error("Veuillez enregistrer ou uploader un audio");
      return;
    }

    try {
      toast.info("Upload de votre audio en cours...");

      // Use session ID from QR code if available, otherwise generate new one
      const sessionId = sessionStorage.getItem('sessionId') || `session-${Date.now()}`;

      // Send audio to backend function (bypasses client RLS)
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${audioBlob.type.includes('webm') ? 'webm' : 'audio'}`);
      formData.append('sessionId', sessionId);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = "Échec de l'upload audio";
        try {
          const err = await res.json();
          errMsg = err?.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const { publicUrl } = await res.json();

      // Store public URL in sessionStorage for processing page
      sessionStorage.setItem("audioUrl", publicUrl);
      sessionStorage.setItem("submissionId", sessionId);

      toast.success("Audio uploadé avec succès!");
      navigate("/processing");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Erreur lors de l'upload. Veuillez réessayer.");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-primary">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            VOXFOLIO
          </h1>
          <p className="text-muted-foreground">
            Enregistrez votre présentation professionnelle (max 2 minutes)
          </p>
        </div>

        <div className="space-y-6">
          {/* Recording Section */}
          <div className="flex flex-col items-center justify-center py-12 bg-muted/50 rounded-lg">
            {isRecording ? (
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center animate-pulse-glow">
                  <Mic className="w-12 h-12 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-destructive">
                  {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                </p>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <StopCircle className="w-5 h-5" />
                  Arrêter l'enregistrement
                </Button>
              </div>
            ) : audioBlob ? (
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-success" />
                </div>
                <p className="text-lg font-semibold text-success">
                  Enregistrement prêt ({formatTime(recordingTime)})
                </p>
                <Button
                  onClick={() => {
                    setAudioBlob(null);
                    setRecordingTime(0);
                  }}
                  variant="outline"
                >
                  Réenregistrer
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-primary" />
                </div>
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="gap-2 bg-gradient-primary hover:opacity-90 shadow-primary"
                >
                  <Mic className="w-5 h-5" />
                  Commencer l'enregistrement
                </Button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Upload Section */}
          <div className="text-center">
            <label htmlFor="audio-upload">
              <div className="cursor-pointer p-8 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-muted/50 transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="font-semibold mb-1">Uploader un fichier audio</p>
                <p className="text-sm text-muted-foreground">MP3, WAV, WebM (max 2 min)</p>
              </div>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!audioBlob}
            size="lg"
            className="w-full bg-gradient-primary hover:opacity-90 shadow-primary"
          >
            Analyser mon audio
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Capture;
