import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Upload, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Teacher {
  id: string;
  prenom: string;
  nom: string;
}

interface Classe {
  id: string;
  nom: string;
}

const Capture = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [lockedClass, setLockedClass] = useState<Classe | null>(null);
  const [isFromQR, setIsFromQR] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const MAX_RECORDING_TIME = 120; // 2 minutes

  useEffect(() => {
    loadTeachers();
    handleQRCodeParams();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedTeacherId) {
      loadClasses(selectedTeacherId);
    }
  }, [selectedTeacherId]);

  const handleQRCodeParams = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const teacherIdFromQR = searchParams.get('teacher');
    const sessionIdFromQR = searchParams.get('session');
    const singleClass = searchParams.get('class');
    const multiClasses = searchParams.get('classes');

    if (teacherIdFromQR) {
      setIsFromQR(true);
      setSelectedTeacherId(teacherIdFromQR);
      sessionStorage.setItem('teacherId', teacherIdFromQR);
    }
    
    if (sessionIdFromQR) {
      sessionStorage.setItem('sessionId', sessionIdFromQR);
    }

    // Handle class parameters
    if (teacherIdFromQR && singleClass) {
      // Single class locked
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, nom')
          .eq('id', singleClass)
          .eq('teacher_id', teacherIdFromQR)
          .single();

        if (!error && data) {
          setLockedClass(data);
          setSelectedClassId(data.id);
          sessionStorage.setItem('classId', data.id);
          sessionStorage.setItem('className', data.nom);
        }
      } catch (error) {
        console.error('Error loading locked class:', error);
        toast.error('Classe introuvable');
      }
    } else if (teacherIdFromQR && multiClasses) {
      // Multiple classes or all
      if (multiClasses === 'all') {
        // Will load all classes via loadClasses
      } else {
        // Load specific classes
        const classIds = multiClasses.split(',');
        try {
          const { data, error } = await supabase
            .from('classes')
            .select('id, nom')
            .in('id', classIds)
            .eq('teacher_id', teacherIdFromQR);

          if (!error && data) {
            setClasses(data);
          }
        } catch (error) {
          console.error('Error loading classes:', error);
        }
      }
    }
  };

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('list-teachers');

      if (error) throw error;

      setTeachers(data?.teachers || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Erreur lors du chargement des enseignants');
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadClasses = async (teacherId: string) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom')
        .eq('teacher_id', teacherId)
        .order('nom');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Erreur lors du chargement des classes');
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const classe = classes.find(c => c.id === classId);
    if (classe) {
      sessionStorage.setItem('classId', classe.id);
      sessionStorage.setItem('className', classe.nom);
    }
  };

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
        toast.error("Sélectionne un fichier audio");
      }
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.error("Enregistre ou uploade un audio");
      return;
    }

    if (!selectedTeacherId) {
      toast.error("Veuillez sélectionner votre enseignant");
      return;
    }

    if (!selectedClassId && !lockedClass) {
      toast.error("Veuillez sélectionner votre classe");
      return;
    }

    try {
      toast.info("Upload de votre audio en cours...");

      // Use session ID from QR code if available, otherwise generate new one
      const sessionId = sessionStorage.getItem('sessionId') || `session-${Date.now()}`;

      // Convert Blob to base64 for edge function invoke
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('upload-audio', {
        body: {
          fileBase64,
          contentType: audioBlob.type,
          sessionId,
        },
      });

      if (error) {
        throw new Error(error.message || "Échec de l'upload audio");
      }

      const publicUrl = (data as any)?.publicUrl as string | undefined;
      if (!publicUrl) {
        throw new Error("URL de fichier manquante");
      }

      // Store public URL and teacher ID in sessionStorage for processing page
      sessionStorage.setItem("audioUrl", publicUrl);
      sessionStorage.setItem("submissionId", sessionId);
      sessionStorage.setItem("teacherId", selectedTeacherId);

      toast.success("Audio uploadé avec succès!");
      navigate("/processing");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Erreur lors de l'upload. Réessaye.");
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
            Voxfolio
          </h1>
          <p className="text-muted-foreground">
            Enregistre ta présentation professionnelle (max 2 min)
          </p>
        </div>

        <div className="space-y-6">
          {/* Teacher Select - Only show if NOT from QR code */}
          {!isFromQR && (
            <div className="space-y-2">
              <Label htmlFor="teacher">Choisis ton enseignant / formateur</Label>
              {loadingTeachers ? (
                <div className="text-sm text-muted-foreground">Chargement des enseignants...</div>
              ) : teachers.length > 0 ? (
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionne ton enseignant" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.prenom} {teacher.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">Aucun enseignant disponible</div>
              )}
            </div>
          )}

          {/* Class Select */}
          {selectedTeacherId && (
            <div className="space-y-2">
              <Label htmlFor="class">Choisis ta classe</Label>
              {lockedClass ? (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
                      Classe assignée
                    </span>
                    <span className="font-semibold">{lockedClass.nom}</span>
                  </div>
                </div>
              ) : classes.length > 0 ? (
                <Select value={selectedClassId} onValueChange={handleClassChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionne ta classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classe) => (
                      <SelectItem key={classe.id} value={classe.id}>
                        {classe.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">Aucune classe disponible</div>
              )}
            </div>
          )}

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
            disabled={!audioBlob || !selectedTeacherId || (!selectedClassId && !lockedClass)}
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
