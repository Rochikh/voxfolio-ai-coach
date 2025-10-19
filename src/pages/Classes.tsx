import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Users, QrCode, Download } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherNav } from '@/components/TeacherNav';
import { QRCodeSVG } from 'qrcode.react';

interface Classe {
  id: string;
  nom: string;
  created_at: string;
}

export default function Classes() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Classe | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
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

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newClassName.trim()) return;

    setIsCreating(true);

    const { error } = await supabase
      .from('classes')
      .insert({
        nom: newClassName.trim(),
        teacher_id: user.id,
      });

    if (error) {
      console.error('Error creating class:', error);
      toast.error('Erreur lors de la création de la classe');
    } else {
      toast.success('Classe créée avec succès !');
      setNewClassName('');
      setIsDialogOpen(false);
      loadClasses();
    }

    setIsCreating(false);
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

  const openClassQR = (classe: Classe) => {
    setSelectedClass(classe);
    const sessionId = crypto.randomUUID();
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/capture?teacher=${user?.id}&session=${sessionId}&class=${classe.id}`;
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
            link.download = `qr-classe-${selectedClass.nom.replace(/\s+/g, '-').toLowerCase()}.png`;
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle classe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle classe</DialogTitle>
                <DialogDescription>
                  Ajoute une nouvelle classe à ton espace enseignant·e
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class-name">Nom de la classe</Label>
                  <Input
                    id="class-name"
                    placeholder="Ex: 3ème A, Terminale S1..."
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? 'Création...' : 'Créer la classe'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {classes.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Aucune classe</h3>
            <p className="text-muted-foreground mb-4">
              Crée ta première classe pour commencer
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une classe
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classe) => (
              <Card key={classe.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{classe.nom}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteClass(classe.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Créée le {new Date(classe.created_at).toLocaleDateString('fr-FR')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    onClick={() => openClassQR(classe)}
                  >
                    <QrCode className="h-4 w-4" />
                    Voir le QR Code
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
            <DialogTitle>QR Code - {selectedClass?.nom}</DialogTitle>
            <DialogDescription>
              Partage ce QR code avec tes apprenant·e·s de {selectedClass?.nom}
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
