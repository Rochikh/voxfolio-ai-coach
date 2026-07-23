import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const POLL_INTERVAL_MS = 2000;
const SLOW_TIMEOUT_MS = 90_000;
// Garde-fou dur : au-delà de ce délai on cesse de tourner indéfiniment et on
// affiche une vraie erreur actionnable, même si la ligne submissions est restée
// bloquée à `pending`/`processing` (ex. fonction serveur interrompue).
const HARD_TIMEOUT_MS = 240_000;
const ROTATING_MESSAGE_INTERVAL_MS = 3500;
const DONE_REDIRECT_DELAY_MS = 500;

const ROTATING_MESSAGES = [
  "Transcription de ton enregistrement…",
  "Analyse de ta présentation…",
  "Génération du feedback…",
  "Création de ton illustration…",
];

const LOG_PREFIX = "[processing]";

type SubmissionStatus = "pending" | "processing" | "done" | "error";

type SubmissionPayload = {
  status: SubmissionStatus;
  error: string | null;
  class_id: string | null;
};

type UiState =
  | { kind: "invalid" }
  | { kind: "loading" }
  | { kind: "working"; status: "pending" | "processing"; slow: boolean }
  | { kind: "done" }
  | { kind: "error"; message: string; classId: string | null };

const Processing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const submissionId = useMemo(() => {
    const raw = searchParams.get("id");
    return raw && UUID_REGEX.test(raw) ? raw : null;
  }, [searchParams]);

  const [uiState, setUiState] = useState<UiState>(
    submissionId ? { kind: "loading" } : { kind: "invalid" },
  );
  const [messageIndex, setMessageIndex] = useState(0);
  // Dernière class_id vue pendant le polling : sert à proposer le bon lien de
  // reprise si le garde-fou dur bascule en erreur.
  const lastClassIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let slowHandle: ReturnType<typeof setTimeout> | null = null;
    let hardHandle: ReturnType<typeof setTimeout> | null = null;
    let doneRedirectHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(LOG_PREFIX, "start polling", submissionId);

    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-submission-status",
          { body: { id: submissionId } },
        );

        if (cancelled) return;

        if (error) {
          console.error(LOG_PREFIX, "invoke error:", error);
          return;
        }

        const payload = data as SubmissionPayload | null;
        if (!payload) {
          console.error(LOG_PREFIX, "empty payload");
          return;
        }

        console.log(LOG_PREFIX, "tick status:", payload.status);
        lastClassIdRef.current = payload.class_id;

        if (payload.status === "done") {
          if (pollHandle) clearInterval(pollHandle);
          pollHandle = null;
          if (slowHandle) clearTimeout(slowHandle);
          slowHandle = null;
          if (hardHandle) clearTimeout(hardHandle);
          hardHandle = null;
          setUiState({ kind: "done" });
          doneRedirectHandle = setTimeout(() => {
            if (!cancelled) {
              console.log(LOG_PREFIX, "redirect /result", submissionId);
              navigate(`/result?id=${submissionId}`);
            }
          }, DONE_REDIRECT_DELAY_MS);
          return;
        }

        if (payload.status === "error") {
          if (pollHandle) clearInterval(pollHandle);
          pollHandle = null;
          if (slowHandle) clearTimeout(slowHandle);
          slowHandle = null;
          if (hardHandle) clearTimeout(hardHandle);
          hardHandle = null;
          setUiState({
            kind: "error",
            message: payload.error?.trim() || "Une erreur est survenue.",
            classId: payload.class_id,
          });
          return;
        }

        // pending | processing : continuer le polling, conserver le flag slow.
        // Les cas done/error ont déjà `return` plus haut, donc le statut restant
        // ne peut être que pending | processing.
        const workingStatus = payload.status as "pending" | "processing";
        setUiState((prev) =>
          prev.kind === "working"
            ? { kind: "working", status: workingStatus, slow: prev.slow }
            : { kind: "working", status: workingStatus, slow: false },
        );
      } catch (e) {
        if (!cancelled) {
          console.error(LOG_PREFIX, "tick exception:", e);
        }
      }
    };

    // Premier appel immédiat puis polling
    tick();
    pollHandle = setInterval(tick, POLL_INTERVAL_MS);

    slowHandle = setTimeout(() => {
      if (cancelled) return;
      console.log(LOG_PREFIX, "slow timeout reached");
      setUiState((prev) =>
        prev.kind === "working" ? { ...prev, slow: true } : prev,
      );
    }, SLOW_TIMEOUT_MS);

    // Garde-fou dur : si aucun statut terminal n'arrive, on arrête de tourner et
    // on affiche une erreur actionnable plutôt qu'un spinner sans fin.
    hardHandle = setTimeout(() => {
      if (cancelled) return;
      if (pollHandle) clearInterval(pollHandle);
      pollHandle = null;
      if (slowHandle) clearTimeout(slowHandle);
      slowHandle = null;
      console.error(LOG_PREFIX, "hard timeout atteint — arrêt du polling");
      setUiState({
        kind: "error",
        message:
          "Le traitement a pris trop de temps et semble avoir été interrompu. Réessaie l'enregistrement.",
        classId: lastClassIdRef.current,
      });
    }, HARD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
      if (slowHandle) clearTimeout(slowHandle);
      if (hardHandle) clearTimeout(hardHandle);
      if (doneRedirectHandle) clearTimeout(doneRedirectHandle);
      console.log(LOG_PREFIX, "cleanup", submissionId);
    };
  }, [submissionId, navigate]);

  // Rotation du sous-message pendant l'attente
  useEffect(() => {
    if (uiState.kind !== "working" && uiState.kind !== "loading") return;
    const id = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, ROTATING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [uiState.kind]);

  if (uiState.kind === "invalid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Lien invalide</h1>
          <p className="text-muted-foreground mb-6">
            L'identifiant de la soumission est manquant ou incorrect.
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

  if (uiState.kind === "error") {
    const captureHref = uiState.classId
      ? `/capture?class=${uiState.classId}`
      : "/capture";
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Une erreur est survenue</h1>
          <p className="text-muted-foreground mb-6">{uiState.message}</p>
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

  if (uiState.kind === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-primary text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Analyse terminée !</h1>
        </Card>
      </div>
    );
  }

  // working | loading
  const slow = uiState.kind === "working" && uiState.slow;
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md p-8 shadow-primary text-center">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-8">
          Voxfolio
        </h1>

        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>

        <h2 className="text-xl font-semibold mb-2">Analyse en cours…</h2>
        <p className="text-muted-foreground min-h-[1.5rem]">
          {ROTATING_MESSAGES[messageIndex]}
        </p>

        {slow && (
          <div className="mt-8 pt-6 border-t border-border space-y-4">
            <div className="flex items-start gap-3 text-left">
              <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Le traitement prend plus de temps que prévu. Tu peux continuer
                d'attendre ou consulter les détails dès qu'ils sont prêts.
              </p>
            </div>
            <Button
              onClick={() => navigate(`/result?id=${submissionId}`)}
              variant="outline"
              className="w-full"
            >
              Voir les détails
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Processing;
