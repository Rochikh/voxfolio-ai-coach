import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProcessingNavigationState } from "./Processing";

// Normalize markdown text to ensure proper rendering
const normalizeMarkdown = (text: string): string => {
  if (!text) return '';
  // Replace any non-standard asterisks with standard ones
  // and ensure proper spacing around markdown syntax
  return text
    .replace(/\*\*/g, '**') // Normalize asterisks
    .replace(/\u2217\u2217/g, '**') // Replace unicode asterisks
    .trim();
};

interface ResultData {
  image: string;
  feedback: string;
  prenom: string;
  objectif: string;
  etapes: string[];
  transcription: string;
}

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get airtableRecordId from navigation state (secure)
    const state = location.state as ProcessingNavigationState | null;
    const airtableRecordId = state?.airtableRecordId;
    
    if (!airtableRecordId) {
      navigate("/capture");
      return;
    }

    const fetchResult = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-airtable', {
          body: { 
            recordId: airtableRecordId 
          }
        });

        if (error) throw error;

        setResultData({
          image: data.image || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=800&h=800&fit=crop",
          feedback: data.feedback || '',
          prenom: data.prenom || '',
          objectif: data.objectif || '',
          etapes: Array.isArray(data.etapes) ? data.etapes : [],
          transcription: data.transcription || ''
        });
        setLoading(false);
      } catch (error) {
        console.error("Error fetching result:", error);
        toast.error("Erreur lors du chargement des résultats");
        navigate("/capture");
      }
    };

    fetchResult();
  }, [navigate, location.state]);

  const handleShare = () => {
    toast.success("Lien de partage copié !");
  };

  const handleDownload = async () => {
    if (!resultData?.image) return;
    
    try {
      const response = await fetch(resultData.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-${resultData.prenom || 'voxfolio'}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image téléchargée !");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  if (!resultData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate("/showcase")}
            variant="ghost"
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la vitrine
          </Button>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Ton portfolio augmenté
          </h1>
          <p className="text-muted-foreground mt-2">
            Résultat de l'analyse IA de ta présentation
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div>
            <Card className="overflow-hidden shadow-primary">
              <img
                src={resultData.image}
                alt="Visuel professionnel généré par IA"
                className="w-full aspect-square object-cover"
              />
            </Card>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleDownload}
                className="flex-1 gap-2"
                variant="outline"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1 gap-2 bg-gradient-primary"
              >
                <Share2 className="w-4 h-4" />
                Partager
              </Button>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            {/* Prénom */}
            <Card className="p-6">
              <Badge className="mb-2">Prénom</Badge>
              <p className="text-foreground text-xl font-semibold">{resultData.prenom}</p>
            </Card>

            {/* Objectif */}
            <Card className="p-6">
              <Badge className="mb-2">Objectif professionnel·le</Badge>
              <p className="text-foreground">{resultData.objectif}</p>
            </Card>

            {/* Étapes */}
            <Card className="p-6">
              <Badge className="mb-2">Étapes du parcours</Badge>
              <ol className="space-y-3 mt-3 list-decimal list-inside">
                {resultData.etapes.map((etape, index) => (
                  <li key={index} className="text-foreground pl-2 marker:text-primary marker:font-bold break-words">
                    {etape}
                  </li>
                ))}
              </ol>
            </Card>

            {/* Feedback AI - en bas */}
            <Card className="p-6 bg-gradient-to-br from-accent/5 to-primary/5 border-2 border-accent/20 shadow-glow">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold">Feedback coach IA</h2>
              </div>
              <div className="text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-strong:font-semibold prose-strong:text-primary">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    strong: ({ children }) => (
                      <strong className="font-semibold text-primary">{children}</strong>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                  }}
                >
                  {normalizeMarkdown(resultData.feedback)}
                </ReactMarkdown>
              </div>
            </Card>

            {/* Action */}
            <Button
              onClick={() => navigate("/capture")}
              className="w-full bg-gradient-primary hover:opacity-90"
              size="lg"
            >
              Créer un nouveau portfolio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;