import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Users, QrCode, Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherNav } from '@/components/TeacherNav';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicAppUrl } from '@/lib/appUrl';

interface Classe {
  id: string;
  nom: string;
  matiere: string | null;
  consignes_evaluation: string | null;
  created_at: string;
}

interface ClassFormState {
  nom: string;
  matiere: string;
  consignes_evaluation: string;
}

const emptyFormState: ClassFormState = {
  nom: '',
  matiere: '',
  consignes_evaluation: '',
};

export default function Classes() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<ClassFormState>(emptyFormState);
  const [editingClass, setEditingClass] = useState<Classe | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Classe | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrType, setQrType] = useState<'capture' | 'showcase'>('capture');
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading classes:', error);
      toast.error('Erreur lors du chargement des classes');
      return;
    }

    setClasses(data || []);
  };

  const openCreateDialog = () => {
    setEditingClass(null);
    setFormState(emptyFormState);
    setIsDialogOpen(true);
  };

  const openEditDialog = (classe: Classe) => {
    setEditingClass(classe);
    setFormState({
      nom: classe.nom,
      matiere: classe.matiere ?? '',
      consignes_evaluation: classe.consignes_evaluation ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingClass(null);
      setFormState(emptyFormState);
    }
  };

  const submitClassForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const nom = formState.nom.trim();
    if (!nom) return;

    const matiere = formState.matiere.trim() || null;
    const consignes = formState.consignes_evaluation.trim() || null;

    setIsSubmitting(true);

    if (editingClass) {
      const { error } = await supabase
        .from('classes')
        .update({
          nom,
          matiere,
          consignes_evaluation: consignes,
        })
        .eq('id', editingClass.id);

      if (error) {
        console.error('Error updating class:', error);
        toast.error('Erreur lors de la modification de la classe');
      } else {
        toast.success('Classe modifiée');
        handleDialogOpenChange(false);
        loadClasses();
      }
    } else {
      const { error } = await supabase
        .from('classes')
        .insert({
          nom,
          matiere,
          consignes_evaluation: consignes,
          teacher_id: user.id,
        });

      if (error) {
        console.error('Error creating class:', error);
        toast.error('Erreur lors de la création de la classe');
      } else {
        toast.success('Classe créée');
        handleDialogOpenChange(false);
        loadClasses();
      }
    }

    setIsSubmitting(false);
  };

  const deleteClass = async (classId: string) => {
    if (!confirm('Es-tu sûr·e de vouloir supprimer cette classe ?')) return;

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);

    if (error) {
      console.error('Error deleting class:', error);
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Classe supprimée');
      loadClasses();
    }
  };

  const openClassQR = (classe: Classe, type: 'capture' | 'showcase') => {
    setSelectedClass(classe);
    setQrType(type);
    const sessionId = crypto.randomUUID();
    const baseUrl = getPublicAppUrl();

    let url: string;
    if (type === 'capture') {
      url = `${baseUrl}/capture?teacher=${user?.id}&session=${sessionId}&class=${classe.id}`;
    } else {
      url = `${baseUrl}/showcase?teacher=${user?.id}&class=${classe.id}`;
    }

    setQrCodeUrl(url);
  };

  const downloadQRCode = async () => {
    if (!qrCodeRef.current || !selectedClass) return;

    try {
      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const typeLabel = qrType === 'capture' ? 'enregistrement' : 'vitrine';
            link.download = `qr-${typeLabel}-${selectedClass.nom.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = downloadUrl;
            link.click();
            URL.revokeObjectURL(downloadUrl);
            toast.success('QR Code téléchargé !');
          }
        });
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Chargement...</p>
      </div>
    );
  }

  const isEditing = editingClass !== null;
  const submitLabel = isSubmitting
    ? isEditing ? 'Enregistrement...' : 'Création...'
    : isEditing ? 'Enregistrer' : 'Créer la classe';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <TeacherNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Mes classes</h2>
            <p className="text-muted-foreground">
              Gère tes classes et tes apprenant·e·s
            </p>
          </div>

          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Nouvelle classe
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Modifier la classe' : 'Créer une nouvelle classe'}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Mets à jour les informations de cette classe'
                  : 'Ajoute une nouvelle classe à ton espace enseignant·e'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitClassForm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-nom">Nom de la classe</Label>
                <Input
                  id="class-nom"
                  placeholder="Ex: 3ème A, Terminale S1..."
                  value={formState.nom}
                  onChange={(e) => setFormState((s) => ({ ...s, nom: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class-matiere">Matière</Label>
                <Input
                  id="class-matiere"
                  placeholder="Ex: Logistique, Électricité industrielle, Mathématiques..."
                  value={formState.matiere}
                  onChange={(e) => setFormState((s) => ({ ...s, matiere: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class-consignes">Consignes pour l'IA</Label>
                <Textarea
                  id="class-consignes"
                  rows={5}
                  placeholder="Décris ce que l'IA doit évaluer dans les présentations de tes apprenants. Ex: vocabulaire technique attendu (tension, intensité...), points de vigilance, type d'exercice. Plus tu es précis·e, plus le feedback sera pertinent."
                  value={formState.consignes_evaluation}
                  onChange={(e) => setFormState((s) => ({ ...s, consignes_evaluation: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Ce texte aide l'IA à adapter son feedback à ta matière. Tu peux le modifier à tout moment.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {classes.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Aucune classe</h3>
            <p className="text-muted-foreground mb-4">
              Crée ta première classe pour commencer
            </p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une classe
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classe) => (
              <Card key={classe.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{classe.nom}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(classe)}
                        aria-label="Modifier la classe"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteClass(classe.id)}
                        className="text-destructive hover:text-destructive"
                        aria-label="Supprimer la classe"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {classe.matiere && (
                      <>
                        {classe.matiere}
                        <br />
                      </>
                    )}
                    Créée le {new Date(classe.created_at).toLocaleDateString('fr-FR')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="default"
                    className="w-full gap-2"
                    onClick={() => openClassQR(classe, 'capture')}
                  >
                    <QrCode className="h-4 w-4" />
                    QR Code - Enregistrement
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => openClassQR(classe, 'showcase')}
                  >
                    <QrCode className="h-4 w-4" />
                    QR Code - Vitrine
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Voir les apprenant·e·s
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* QR Code Dialog */}
      <Dialog open={!!selectedClass} onOpenChange={() => setSelectedClass(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              QR Code {qrType === 'capture' ? '- Enregistrement' : '- Vitrine'} - {selectedClass?.nom}
            </DialogTitle>
            <DialogDescription>
              {qrType === 'capture'
                ? `Partage ce QR code avec tes apprenant·e·s de ${selectedClass?.nom} pour qu'ils enregistrent leur production`
                : `Partage ce QR code avec tes apprenant·e·s de ${selectedClass?.nom} pour qu'ils voient les productions de leurs pairs`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {qrCodeUrl && (
              <div className="flex flex-col items-center space-y-4">
                <div
                  ref={qrCodeRef}
                  className="bg-white p-4 rounded-lg shadow-sm"
                >
                  <QRCodeSVG value={qrCodeUrl} size={256} level="H" />
                </div>

                <Button
                  onClick={downloadQRCode}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Télécharger le QR Code
                </Button>

                <div className="w-full p-4 bg-muted rounded-lg space-y-2 text-sm">
                  <p className="font-semibold">Informations :</p>
                  <p className="text-muted-foreground">
                    <strong>Classe :</strong> {selectedClass?.nom}
                  </p>
                  <p className="text-muted-foreground break-all">
                    <strong>URL :</strong> {qrCodeUrl}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
