import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const LOG = "[showcase]";

type SubmissionStatus = "pending" | "processing" | "done" | "error";

type SubmissionItem = {
  id: string;
  student_name: string;
  avatar_url: string | null;
  status: SubmissionStatus;
  score_global: number | null;
  synthese: string | null;
  error: string | null;
  created_at: string;
  classe: { id: string | null; nom: string; matiere: string | null } | null;
};

type ClassOption = { id: string; nom: string };

type AuthRow = {
  id: string;
  student_name: string;
  avatar_url: string | null;
  status: SubmissionStatus;
  feedback: {
    score_global?: number;
    synthese?: string;
  } | null;
  error: string | null;
  created_at: string;
  class_id: string;
  classes: { id: string; nom: string; matiere: string | null } | null;
};

type QrSubmissionDTO = {
  id: string;
  student_name: string;
  avatar_url: string | null;
  score_global: number | null;
  status: SubmissionStatus;
  created_at: string;
  classe: { nom: string; matiere: string | null } | null;
};

const SCORE_BADGE = (score: number) => {
  if (score >= 7) return "bg-green-600 text-white";
  if (score >= 5) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
};

const Showcase = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

  const teacherIdFromQR = searchParams.get("teacher");
  const classIdFromQR = searchParams.get("class");
  const statusFilter = searchParams.get("status");
  const isFromQR = !!teacherIdFromQR;

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorDialog, setErrorDialog] = useState<
    { id: string; message: string | null } | null
  >(null);

  useEffect(() => {
    if (isFromQR) {
      void fetchQR(teacherIdFromQR!, classIdFromQR);
      return;
    }

    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void fetchAuth(statusFilter);
  }, [user, authLoading, isFromQR, teacherIdFromQR, classIdFromQR, statusFilter]);

  const fetchAuth = async (status: string | null) => {
    setLoading(true);
    try {
      console.log(LOG, "fetch auth mode", { status });
      let q = supabase
        .from("submissions")
        .select(
          "id, student_name, avatar_url, status, feedback, error, created_at, class_id, classes!inner(id, nom, matiere)",
        )
        .order("created_at", { ascending: false });

      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as unknown as AuthRow[];

      const mapped: SubmissionItem[] = rows.map((r) => ({
        id: r.id,
        student_name: r.student_name,
        avatar_url: r.avatar_url,
        status: r.status,
        score_global:
          r.feedback && typeof r.feedback.score_global === "number"
            ? r.feedback.score_global
            : null,
        synthese:
          r.feedback && typeof r.feedback.synthese === "string"
            ? r.feedback.synthese
            : null,
        error: r.error,
        created_at: r.created_at,
        classe: r.classes
          ? { id: r.classes.id, nom: r.classes.nom, matiere: r.classes.matiere }
          : null,
      }));

      const seen = new Map<string, string>();
      for (const s of mapped) {
        if (s.classe?.id && !seen.has(s.classe.id)) {
          seen.set(s.classe.id, s.classe.nom);
        }
      }
      const classOptions: ClassOption[] = Array.from(seen.entries())
        .map(([id, nom]) => ({ id, nom }))
        .sort((a, b) => a.nom.localeCompare(b.nom));

      setClasses(classOptions);
      setSubmissions(mapped);
      console.log(LOG, "auth fetched", mapped.length);
    } catch (e) {
      console.error(LOG, "auth fetch error:", e);
      toast.error("Erreur lors du chargement des productions");
    } finally {
      setLoading(false);
    }
  };

  const fetchQR = async (teacherId: string, classId: string | null) => {
    setLoading(true);
    try {
      console.log(LOG, "fetch QR mode", { teacherId, classId });
      const { data, error } = await supabase.functions.invoke(
        "list-submissions",
        {
          body: { teacherId, classId: classId ?? undefined },
        },
      );

      if (error) throw error;

      const list = (data?.submissions || []) as QrSubmissionDTO[];
      const mapped: SubmissionItem[] = list.map((s) => ({
        id: s.id,
        student_name: s.student_name,
        avatar_url: s.avatar_url,
        status: s.status,
        score_global: s.score_global,
        synthese: null,
        error: null,
        created_at: s.created_at,
        classe: s.classe
          ? { id: null, nom: s.classe.nom, matiere: s.classe.matiere }
          : null,
      }));

      setSubmissions(mapped);
      console.log(LOG, "QR fetched", mapped.length);
    } catch (e) {
      console.error(LOG, "QR fetch error:", e);
      toast.error("Impossible de charger les productions");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((s) => {
      const okSearch = !q || s.student_name.toLowerCase().includes(q);
      const okClass =
        isFromQR ||
        selectedClassId === "all" ||
        s.classe?.id === selectedClassId;
      return okSearch && okClass;
    });
  }, [submissions, searchQuery, selectedClassId, isFromQR]);

  const headerSubtitle = useMemo(() => {
    if (isFromQR) {
      const className = submissions[0]?.classe?.nom;
      return classIdFromQR && className
        ? `Vitrine des productions - ${className}`
        : "Vitrine des productions";
    }
    if (statusFilter === "error") return "Productions en erreur";
    return "Vitrine des productions de votre classe";
  }, [isFromQR, classIdFromQR, statusFilter, submissions]);

  const handleCardClick = (s: SubmissionItem) => {
    if (s.status === "done") {
      navigate(`/result?id=${s.id}`);
    } else if (s.status === "pending" || s.status === "processing") {
      navigate(`/processing?id=${s.id}`);
    } else if (s.status === "error") {
      setErrorDialog({ id: s.id, message: s.error });
    }
  };

  const handleRelaunch = () => {
    if (!errorDialog) return;
    const id = errorDialog.id;
    console.log(LOG, "relaunch", id);
    void supabase.functions
      .invoke("process-submission", { body: { submission_id: id } })
      .catch((e) => console.error(LOG, "relaunch error (non-blocking):", e));
    setErrorDialog(null);
    toast.success("Analyse relancée");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                VOXFOLIO
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {headerSubtitle}
              </p>
            </div>
            <div className="flex gap-2">
              {user && !isFromQR && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Tableau de bord
                </Button>
              )}
              {!isFromQR && (
                <Button
                  onClick={() => navigate("/capture")}
                  className="gap-2 bg-gradient-primary hover:opacity-90 shadow-primary"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau Portfolio
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!isFromQR && classes.length > 0 && (
          <div className="mb-6">
            <Tabs value={selectedClassId} onValueChange={setSelectedClassId}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="all">Toutes les classes</TabsTrigger>
                {classes.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>
                    {c.nom}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Rechercher un apprenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune production trouvée</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((s) => (
              <Card
                key={s.id}
                className="overflow-hidden cursor-pointer hover:shadow-primary transition-all duration-300 hover:scale-105 group"
                onClick={() => handleCardClick(s)}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt={`Production de ${s.student_name}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {s.status === "pending" || s.status === "processing" ? (
                        <Loader2 className="w-12 h-12 animate-spin" />
                      ) : s.status === "error" ? (
                        <AlertCircle className="w-12 h-12 text-red-600" />
                      ) : (
                        <ImageIcon className="w-12 h-12" />
                      )}
                    </div>
                  )}

                  <div className="absolute top-2 right-2">
                    {s.status === "done" && s.score_global !== null && (
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold shadow ${SCORE_BADGE(
                          s.score_global,
                        )}`}
                      >
                        {s.score_global.toFixed(1)}/10
                      </span>
                    )}
                    {(s.status === "pending" || s.status === "processing") && (
                      <span className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-500 text-white shadow">
                        En cours…
                      </span>
                    )}
                    {s.status === "error" && (
                      <span className="px-2 py-1 rounded-md text-xs font-semibold bg-red-700 text-white shadow">
                        Erreur
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">
                    {s.student_name}
                  </h3>
                  {s.synthese && (
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {s.synthese}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog
        open={!!errorDialog}
        onOpenChange={(open) => {
          if (!open) setErrorDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erreur lors de l'analyse</AlertDialogTitle>
            <AlertDialogDescription>
              {errorDialog?.message ||
                "Une erreur inconnue est survenue pendant l'analyse de cette production."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelaunch}>
              Relancer l'analyse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Showcase;
