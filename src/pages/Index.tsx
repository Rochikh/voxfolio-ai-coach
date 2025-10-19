import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Sparkles, Award, Users, LogIn } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="absolute top-0 right-0 p-4 z-20">
        <Button
          onClick={() => navigate("/login")}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <LogIn className="w-4 h-4" />
          Espace Enseignant
        </Button>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl animate-pulse-glow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }}></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent animate-float">
              VOXFOLIO
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Transformez votre voix en portfolio professionnel augmenté par l'IA
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => navigate("/capture")}
              size="lg"
              className="gap-2 bg-gradient-primary hover:opacity-90 shadow-primary text-lg px-8 py-6"
            >
              <Mic className="w-5 h-5" />
              Commencer maintenant
            </Button>
            <Button
              onClick={() => navigate("/showcase")}
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
            >
              <Users className="w-5 h-5 mr-2" />
              Voir la vitrine
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-20">
            <div className="p-6 rounded-lg bg-card shadow-primary border hover:scale-105 transition-transform">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Enregistrez</h3>
              <p className="text-muted-foreground">
                Parlez de votre parcours professionnel en 2 minutes maximum
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card shadow-glow border hover:scale-105 transition-transform">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">L'IA analyse</h3>
              <p className="text-muted-foreground">
                Transcription, analyse et génération de votre visuel professionnel
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card shadow-primary border hover:scale-105 transition-transform">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <Award className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Valorisez</h3>
              <p className="text-muted-foreground">
                Recevez un feedback personnalisé et votre portfolio augmenté
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>© 2025 VOXFOLIO - Outil de coaching pédagogique augmenté par l'IA</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
