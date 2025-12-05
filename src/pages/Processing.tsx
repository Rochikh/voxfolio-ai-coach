import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Sparkles, Image as ImageIcon, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CaptureNavigationState } from "./Capture";

// Navigation state for Result page
export interface ProcessingNavigationState {
  airtableRecordId: string;
}

const Processing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Sparkles, text: "Transcription de ton audio...", duration: 30 },
    { icon: MessageSquare, text: "Analyse IA en cours...", duration: 35 },
    { icon: ImageIcon, text: "Génération de ton visuel professionnel·le...", duration: 35 },
  ];

  useEffect(() => {
    // Get data from navigation state (secure) instead of sessionStorage
    const state = location.state as CaptureNavigationState | null;
    
    if (!state?.audioUrl || !state?.submissionId) {
      navigate("/capture");
      return;
    }

    const { audioUrl, submissionId, teacherId, className, classId } = state;

    // Webhook Make.com
    const makeWebhookUrl = "https://hook.eu1.make.com/v72ikpqnmgsbdzyvb9r3d03nrsqv14kx";
    
    // Call Make.com webhook
    const processWithMake = async () => {
      try {
        // Validate that audioUrl is a proper HTTPS URL
        if (!audioUrl.startsWith('https://')) {
          console.error("Invalid audio URL format");
          throw new Error("Format d'URL audio invalide");
        }

        // Get teacher UUID from state or from authenticated user
        let teacherUUID = teacherId;
        
        if (!teacherUUID) {
          // Fallback: try to get UUID from authenticated user
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            teacherUUID = user.id;
          }
        }

        // Generate unique learner UUID (session-based since learners don't have accounts)
        const learnerUUID = submissionId;

        // Real POST to Make.com with UUIDs and class info
        const response = await fetch(makeWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId,
            audio_url: audioUrl,
            ID_Enseignant: teacherUUID || "default",
            ID_Utilisateur: learnerUUID,
            Classe_Nom: className || null,
            Classe_ID: classId || null,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Webhook error: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Progress simulation during processing
        let totalProgress = 0;
        const interval = setInterval(() => {
          totalProgress += 1;
          setProgress(totalProgress);

          // Update current step based on progress
          if (totalProgress < 33) setCurrentStep(0);
          else if (totalProgress < 66) setCurrentStep(1);
          else setCurrentStep(2);

          if (totalProgress >= 100) {
            clearInterval(interval);
            
            // Navigate with state instead of sessionStorage
            const resultState: ProcessingNavigationState = {
              airtableRecordId: result?.airtable_record_id || `rec_mock_${submissionId}`,
            };
            
            setTimeout(() => navigate("/result", { state: resultState }), 500);
          }
        }, 200); // 20 seconds total (100 * 200ms)

        return () => clearInterval(interval);
      } catch (error) {
        console.error("Processing error:", error);
        toast.error("Erreur lors du traitement. Veuillez réessayer.");
        setTimeout(() => navigate("/capture"), 2000);
      }
    };

    processWithMake();
  }, [navigate, location.state]);

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-glow rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo */}
        <h1 className="text-5xl font-bold text-white mb-12 animate-float">
          Voxfolio
        </h1>

        {/* Main Icon */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center animate-pulse-glow border-4 border-white/20">
            <CurrentIcon className="w-16 h-16 text-white" />
          </div>
        </div>

        {/* Current Step Text */}
        <h2 className="text-2xl font-semibold text-white mb-8">
          {steps[currentStep].text}
        </h2>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out shadow-glow"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-white/80 mt-4 text-lg font-medium">{progress}%</p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-6 mb-8">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div key={index} className="flex flex-col items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    index <= currentStep
                      ? "bg-white text-primary scale-110"
                      : "bg-white/20 text-white/60"
                  }`}
                >
                  <StepIcon className="w-6 h-6" />
                </div>
                <span className={`text-xs ${index <= currentStep ? "text-white font-semibold" : "text-white/60"}`}>
                  Étape {index + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Encouraging Message */}
        <p className="text-white/90 text-lg max-w-md mx-auto">
          Ton IA travaille pour créer ton portfolio professionnel·le augmenté...
        </p>

        {/* Loading Spinner */}
        <div className="mt-8">
          <Loader2 className="w-8 h-8 text-white mx-auto animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default Processing;