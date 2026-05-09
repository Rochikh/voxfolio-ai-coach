import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, StopCircle, LayoutDashboard, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Still imported by Processing.tsx; will be removed when Processing is reworked.
export interface CaptureNavigationState {
  audioUrl: string;
  submissionId: string;
  teacherId: string;
  className?: string;
  classId?: string;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MAX_RECORDING_TIME = 120; // 2 minutes

const Capture = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const classId = useMemo(() => {
    const raw = searchParams.get("class");
    return raw && UUID_REGEX.test(raw) ? raw : null;
  }, [searchParams]);

  const qrSessionId = searchParams.get("session");

  const [studentName, setStudentName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
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
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
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

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.error("Enregistre un audio d'abord");
      return;
    }

    const trimmedName = studentName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      toast.error("Ton prénom est requis (1 à 100 caractères)");
      return;
    }

    if (!classId) return; // unreachable: invalid-QR view returned earlier

    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const sessionId = qrSessionId || `session-${Date.now()}`;

      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("upload-audio", {
        body: {
          fileBase64,
          contentType: audioBlob.type,
          sessionId,
          student_name: trimmedName,
          class_id: classId,
        },
      });

      if (error) {
        let msg = "Erreur lors de l'upload. Réessaye.";
        try {
          const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
          const body = await ctx?.json?.();
          const candidate = (body as { error?: unknown } | undefined)?.error;
          if (typeof candidate === "string" && candidate.length > 0) {
            msg = candidate;
          }
        } catch {
          // keep default message
        }
        setSubmitError(msg);
        toast.error(msg);
        return;
      }

      const submissionId = (data as { submission_id?: unknown } | null)?.submission_id;
      if (typeof submissionId !== "string" || submissionId.length === 0) {
        const msg = "Réponse serveur invalide";
        setSubmitError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Audio envoyé !");
      navigate(`/processing?id=${submissionId}`);
    } catch (e) {
      console.error("Submit error:", e);
      const msg = "Erreur lors de l'upload. Réessaye.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!classId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">QR code invalide</h1>
          <p className="text-muted-foreground">
            Demande à ton enseignant·e de regénérer le QR code.
          </p>
        </Card>
      </div>
    );
  }

  const canStartRecording = studentName.trim().length > 0;
  const canSubmit = !!audioBlob && canStartRecording && !isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      {user && (
        <div className="container max-w-2xl mx-auto pt-4 pb-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Mon tableau de bord
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
        <Card className="w-full max-w-2xl p-8 shadow-primary">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              Voxfolio
            </h1>
            <p className="text-muted-foreground">
              Enregistre ta présentation professionnelle (max 2 min)
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="student-name">Ton prénom</Label>
              <Input
                id="student-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ex : Léa"
                minLength={1}
                maxLength={100}
                disabled={isRecording || isSubmitting}
                autoComplete="given-name"
              />
            </div>

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
                    disabled={isSubmitting}
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
                    disabled={!canStartRecording}
                    size="lg"
                    className="gap-2 bg-gradient-primary hover:opacity-90 shadow-primary"
                  >
                    <Mic className="w-5 h-5" />
                    Commencer l'enregistrement
                  </Button>
                </div>
              )}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="lg"
              className="w-full bg-gradient-primary hover:opacity-90 shadow-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Analyser mon audio"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Capture;
