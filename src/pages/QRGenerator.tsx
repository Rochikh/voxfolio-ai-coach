import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { TeacherNav } from '@/components/TeacherNav';
import { supabase } from '@/integrations/supabase/client';

interface Classe {
  id: string;
  nom: string;
}

export default function QRGenerator() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [qrUrl, setQrUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [airtableTeacherId, setAirtableTeacherId] = useState('');
  const [classes, setClasses] = useState<Classe[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [qrType, setQrType] = useState<'teacher' | 'class'>('teacher');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      loadClasses();
    }
  }, [user, loading, navigate]);

  const loadClasses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom')
        .eq('teacher_id', user.id)
        .order('nom');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Erreur lors du chargement des classes');
    }
  };

  const generateQRCode = async (type: 'teacher' | 'class' = 'teacher') => {
    if (!user) return;

    try {
      const teacherUUID = user.id;
      setAirtableTeacherId(teacherUUID);

      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);

      let url = `${window.location.origin}/capture?teacher=${teacherUUID}&session=${newSessionId}`;

      if (type === 'class' && selectedClasses.length > 0) {
        if (selectedClasses.length === 1) {
          url += `&class=${selectedClasses[0]}`;
        } else if (selectedClasses.length === classes.length) {
          url += `&classes=all`;
        } else {
          url += `&classes=${selectedClasses.join(',')}`;
        }
      }

      setQrUrl(url);
      setQrType(type);

      toast.success('QR Code généré !');
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erreur lors de la génération du QR code');
    }
  };

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      
      let filename = 'qr-code.png';
      if (qrType === 'teacher') {
        filename = 'qr-enseignant.png';
      } else if (selectedClasses.length === 1) {
        const classe = classes.find(c => c.id === selectedClasses[0]);
        filename = `qr-classe-${classe?.nom || 'unknown'}.png`;
      } else if (selectedClasses.length === classes.length) {
        filename = 'qr-toutes-classes.png';
      } else {
        filename = 'qr-classes-multiples.png';
      }
      
      downloadLink.download = filename;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      toast.success('QR Code téléchargé !');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Générateur de QR Code</h1>
          <p className="text-muted-foreground">
            Générez un QR code pour que vos apprenants accèdent directement à la page de capture
          </p>
        </div>

        <Tabs defaultValue="teacher" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="teacher">QR Code Enseignant</TabsTrigger>
            <TabsTrigger value="class">QR Code Classe(s)</TabsTrigger>
            <TabsTrigger value="showcase">QR Code Vitrine</TabsTrigger>
          </TabsList>

          <TabsContent value="teacher" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>QR Code Enseignant Simple</CardTitle>
                <CardDescription>
                  Vos élèves choisiront leur classe après avoir scanné le QR code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => generateQRCode('teacher')} 
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Générer QR Code Enseignant
                </Button>

                {qrUrl && qrType === 'teacher' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg flex justify-center">
                      <QRCodeSVG
                        id="qr-code"
                        value={qrUrl}
                        size={256}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <Button onClick={downloadQRCode} className="w-full" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="class" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>QR Code pour Classe(s) Spécifique(s)</CardTitle>
                <CardDescription>
                  Sélectionnez les classes qui pourront utiliser ce QR code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {classes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Vous n'avez pas encore de classes.</p>
                    <Button 
                      variant="link" 
                      onClick={() => navigate('/classes')}
                      className="mt-2"
                    >
                      Créer une classe
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                          id="all-classes"
                          checked={selectedClasses.length === classes.length}
                          onCheckedChange={toggleAllClasses}
                        />
                        <label
                          htmlFor="all-classes"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Toutes mes classes
                        </label>
                      </div>

                      {classes.map((classe) => (
                        <div key={classe.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={classe.id}
                            checked={selectedClasses.includes(classe.id)}
                            onCheckedChange={() => toggleClass(classe.id)}
                          />
                          <label
                            htmlFor={classe.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {classe.nom}
                          </label>
                        </div>
                      ))}
                    </div>

                    <Button 
                      onClick={() => generateQRCode('class')} 
                      className="w-full"
                      disabled={selectedClasses.length === 0}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Générer QR Code pour {selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''}
                    </Button>

                    {qrUrl && qrType === 'class' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-white rounded-lg flex justify-center">
                          <QRCodeSVG
                            id="qr-code"
                            value={qrUrl}
                            size={256}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">Classes sélectionnées :</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedClasses.map(id => classes.find(c => c.id === id)?.nom).join(', ')}
                          </p>
                        </div>
                        <Button onClick={downloadQRCode} className="w-full" variant="outline">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="showcase" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>QR Code Vitrine</CardTitle>
                <CardDescription>
                  Générez un QR code pour que vos apprenants puissent consulter la vitrine des portfolios de leur classe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {classes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Vous n'avez pas encore de classes.</p>
                    <Button 
                      variant="link" 
                      onClick={() => navigate('/classes')}
                      className="mt-2"
                    >
                      Créer une classe
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {classes.map((classe) => (
                        <Button
                          key={classe.id}
                          variant={selectedClasses.includes(classe.id) ? "default" : "outline"}
                          className="w-full justify-start"
                           onClick={() => {
                            setSelectedClasses([classe.id]);
                            const origin = window.location.origin;
                            const url = `${origin}/showcase?teacher=${user?.id}&class=${classe.id}`;
                            console.log('QRGenerator showcase URL:', { origin, url });
                            setQrUrl(url);
                            setQrType('class');
                          }}
                        >
                          {classe.nom}
                        </Button>
                      ))}
                    </div>

                      {qrUrl && qrType === 'class' && selectedClasses.length === 1 && (
                        <div className="space-y-4">
                          <div className="p-4 bg-white rounded-lg flex justify-center">
                            <QRCodeSVG
                              id="qr-code"
                              value={qrUrl}
                              size={256}
                              level="H"
                              includeMargin={true}
                            />
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Classe sélectionnée :</p>
                            <p className="text-xs text-muted-foreground">
                              {classes.find(c => c.id === selectedClasses[0])?.nom}
                            </p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Lien vitrine :</p>
                            <p className="text-xs font-mono break-all">{qrUrl}</p>
                            <Button
                              size="sm"
                              className="mt-2"
                              variant="secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(qrUrl);
                                toast.success('Lien copié');
                              }}
                            >
                              Copier le lien
                            </Button>
                          </div>
                          <Button onClick={downloadQRCode} className="w-full" variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </Button>
                        </div>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Informations de Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                UUID Enseignant
              </p>
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                {airtableTeacherId || 'Non configuré'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                UUID Session
              </p>
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                {sessionId || 'Aucune session'}
              </p>
            </div>
            {qrUrl && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  URL de Capture
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {qrUrl}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
