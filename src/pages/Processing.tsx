import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Image as ImageIcon, MessageSquare } from "lucide-react";

const Processing = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Sparkles, text: "Transcription de votre audio...", duration: 30 },
    { icon: MessageSquare, text: "Analyse IA en cours...", duration: 35 },
    { icon: ImageIcon, text: "Génération de votre visuel professionnel...", duration: 35 },
  ];

  useEffect(() => {
    const audioUrl = sessionStorage.getItem("audioUrl");
    const submissionId = sessionStorage.getItem("submissionId");

    if (!audioUrl || !submissionId) {
      navigate("/capture");
      return;
    }

    // Simulate webhook call to Make.com
    const makeWebhookUrl = "https://hook.eu1.make.com/your-webhook-url"; // To be replaced
    
    // In production, this would be a real API call
    const mockProcessing = async () => {
      try {
        // This would be the actual POST to Make.com
        /*
        const response = await fetch(makeWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId,
            audio_url: audioUrl,
            ID_Enseignant: "teacher_001", // From session/auth
            ID_Utilisateur: "student_001", // From session/auth
          }),
        });
        
        const result = await response.json();
        */
        
        // Simulate processing time
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
            // Store mock result
            sessionStorage.setItem("airtableRecordId", "rec_mock_" + submissionId);
            setTimeout(() => navigate("/result"), 500);
          }
        }, 200); // 20 seconds total (100 * 200ms)

        return () => clearInterval(interval);
      } catch (error) {
        console.error("Processing error:", error);
        navigate("/capture");
      }
    };

    mockProcessing();
  }, [navigate]);

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
          VOXFOLIO
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
          Votre IA travaille pour créer votre portfolio professionnel augmenté...
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
