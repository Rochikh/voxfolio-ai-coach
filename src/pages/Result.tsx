import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  Share2,
  Sparkles,
  ThumbsUp,
  Target,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const LOG_PREFIX = "[result]";

type SubmissionStatus = "pending" | "processing" | "done" | "error";

type FeedbackPoint = { titre: string; description: string };
type FeedbackAxis = { titre: string; description: string; conseil: string };

type FeedbackJson = {
  score_global: number;
  synthese: string;
  erreurs_techniques?: Array<{ affirmation: string; probleme: string; correction: string }>;
  points_forts: FeedbackPoint[];
  axes_amelioration: FeedbackAxis[];
  transcription_corrigee: string;
  prompt_image: string;
  duree_secondes: number;
  nombre_mots: number;
  debit_mots_par_minute: number;
};

type SubmissionPayload = {
  status: SubmissionStatus;
  error: string | null;
  class_id: string | null;
  student_name: string | null;
  transcription: string | null;
  feedback: FeedbackJson | null;
  avatar_url: string | null;
};

type LoadState =
  | { kind: "invalid" }
  | { kind: "loading" }
  | { kind: "ready"; data: SubmissionPayload }
  | { kind: "error"; message: string; classId: string | null };

const formatScore = (score: number): string => {
  if (!Number.isFinite(score)) return "—";
  return Number.isInteger(score) ? `${score}` : score.toFixed(1);
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}min ${secs.toString().padStart(2, "0")}s`;
};

const Result = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const submissionId = useMemo(() => {
    const raw = searchParams.get("id");
    return raw && UUID_REGEX.test(raw) ? raw : null;
  }, [searchParams]);

  const [state, setState] = useState<LoadState>(
    submissionId ? { kind: "loading" } : { kind: "invalid" },
  );

  useEffect(() => {
    if (!submissionId) return;

    let cancelled = false;
    console.log(LOG_PREFIX, "fetch", submissionId);

    const fetchResult = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-submission-status",
          { body: { id: submissionId } },
        );

        if (cancelled) return;

        if (error) {
          console.error(LOG_PREFIX, "invoke error:", error);
          setState({
            kind: "error",
            message: "Impossible de charger le résultat. Réessaie plus tard.",
            classId: null,
          });
          return;
        }

        const payload = data as SubmissionPayload | null;
        if (!payload) {
          setState({
            kind: "error",
            message: "Réponse serveur vide.",
            classId: null,
          });
          return;
        }

        if (payload.status === "pending" || payload.status === "processing") {
          console.log(LOG_PREFIX, "status pending/processing → /processing");
          navigate(`/processing?id=${submissionId}`, { replace: true });
          return;
        }

        if (payload.status === "error") {
          setState({
            kind: "error",
            message: payload.error?.trim() || "Une erreur est survenue.",
            classId: payload.class_id,
          });
          return;
        }

        // status === "done"
        if (!payload.feedback) {
          setState({
            kind: "error",
            message: "Résultat incomplet.",
            classId: payload.class_id,
          });
          return;
        }

        setState({ kind: "ready", data: payload });
      } catch (e) {
        if (cancelled) return;
        console.error(LOG_PREFIX, "exception:", e);
        setState({
          kind: "error",
          message: "Erreur réseau.",
          classId: null,
        });
      }
    };

    fetchResult();

    return () => {
      cancelled = true;
    };
  }, [submissionId, navigate]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Lien de partage copié !");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  if (state.kind === "invalid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Lien invalide</h1>
          <p className="text-muted-foreground mb-6">
            L'identifiant du résultat est manquant ou incorrect.
          </p>
          <Button
            onClick={() => navigate("/capture")}
            className="bg-gradient-primary hover:opacity-90"
          >
            Retour à la capture
          </Button>
        </Card>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (state.kind === "error") {
    const captureHref = state.classId
      ? `/capture?class=${state.classId}`
      : "/capture";
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Une erreur est survenue</h1>
          <p className="text-muted-foreground mb-6">{state.message}</p>
          <Button
            onClick={() => navigate(captureHref)}
            className="bg-gradient-primary hover:opacity-90"
          >
            Retour à la capture
          </Button>
        </Card>
      </div>
    );
  }

  // ready
  const { data } = state;
  const feedback = data.feedback!;
  const prenom = data.student_name || "";
  const transcription =
    feedback.transcription_corrigee?.trim() || data.transcription?.trim() || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate("/capture")}
            variant="ghost"
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Nouvelle capture
          </Button>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Ton portfolio augmenté
          </h1>
          <p className="text-muted-foreground mt-2">
            {prenom ? `Bravo ${prenom} ! ` : ""}Voici l'analyse IA de ta présentation.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image + métriques */}
          <div className="space-y-4">
            {data.avatar_url && (
              <Card className="overflow-hidden shadow-primary">
                <img
                  src={data.avatar_url}
                  alt="Visuel généré par IA"
                  className="w-full aspect-square object-cover"
                />
              </Card>
            )}

            {data.avatar_url && (
              <div className="flex gap-3">
                <Button
                  onClick={handleShare}
                  className="flex-1 gap-2 bg-gradient-primary"
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </Button>
              </div>
            )}

            <Card className="p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Métriques
                </h2>
                <span className="text-sm text-muted-foreground">
                  Score&nbsp;
                  <span className="font-semibold text-foreground">
                    {formatScore(feedback.score_global)}/10
                  </span>
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">Durée</dt>
                  <dd className="text-lg font-semibold">
                    {formatDuration(feedback.duree_secondes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mots</dt>
                  <dd className="text-lg font-semibold">{feedback.nombre_mots}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Débit</dt>
                  <dd className="text-lg font-semibold">
                    {feedback.debit_mots_par_minute}
                    <span className="text-xs text-muted-foreground ml-1">mpm</span>
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Feedback */}
          <div className="space-y-6">
            {feedback.erreurs_techniques && feedback.erreurs_techniques.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <h2 className="text-xl font-semibold">Points à corriger</h2>
                </div>
                <ul className="space-y-5">
                  {feedback.erreurs_techniques.map((err, idx) => (
                    <li key={idx}>
                      <p className="text-sm italic text-muted-foreground mb-1">
                        « {err.affirmation} »
                      </p>
                      <p className="text-sm text-foreground mb-2">{err.probleme}</p>
                      <div className="bg-destructive/5 border-l-2 border-destructive rounded-r p-3">
                        <Badge variant="outline" className="mb-2">
                          La bonne pratique
                        </Badge>
                        <p className="text-sm text-foreground">{err.correction}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Points forts */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ThumbsUp className="w-5 h-5 text-success" />
                <h2 className="text-xl font-semibold">Points forts</h2>
              </div>
              <ul className="space-y-4">
                {feedback.points_forts.map((point, idx) => (
                  <li key={idx}>
                    <h3 className="font-semibold text-foreground mb-1">
                      {point.titre}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {point.description}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Axes d'amélioration */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Axes d'amélioration</h2>
              </div>
              <ul className="space-y-5">
                {feedback.axes_amelioration.map((axis, idx) => (
                  <li key={idx}>
                    <h3 className="font-semibold text-foreground mb-1">
                      {axis.titre}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {axis.description}
                    </p>
                    <div className="bg-primary/5 border-l-2 border-primary rounded-r p-3">
                      <Badge variant="outline" className="mb-2">
                        Conseil
                      </Badge>
                      <p className="text-sm text-foreground">{axis.conseil}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Transcription */}
            {transcription && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h2 className="text-xl font-semibold">Transcription</h2>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {transcription}
                </p>
              </Card>
            )}

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
