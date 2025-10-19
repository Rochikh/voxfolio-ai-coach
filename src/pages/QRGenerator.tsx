import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { TeacherNav } from '@/components/TeacherNav';

export default function QRGenerator() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [qrUrl, setQrUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [airtableTeacherId, setAirtableTeacherId] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      generateQRCode();
    }
  }, [user, loading, navigate]);

  const generateQRCode = async () => {
    if (!user) return;

    try {
      // Use the actual user UUID from Lovable Cloud
      const teacherUUID = user.id;
      setAirtableTeacherId(teacherUUID);

      // Generate unique session ID (this will be the learner's UUID)
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);

      // Generate QR code URL with teacher UUID
      const url = `${window.location.origin}/capture?teacher=${teacherUUID}&session=${newSessionId}`;
      setQrUrl(url);

      toast.success('QR Code généré avec UUID enseignant !');
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erreur lors de la génération du QR code');
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
      downloadLink.download = `qr-code-session-${sessionId.slice(0, 8)}.png`;
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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Générateur de QR Code</h1>
          <p className="text-muted-foreground">
            Générez un QR code pour que vos apprenants accèdent directement à la page de capture
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>QR Code de Session</CardTitle>
              <CardDescription>
                Scannez ce code pour accéder à la capture audio
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {qrUrl ? (
                <>
                  <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      id="qr-code"
                      value={qrUrl}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button onClick={downloadQRCode} className="flex-1" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                    <Button onClick={generateQRCode} className="flex-1" variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Régénérer
                    </Button>
                  </div>
                </>
              ) : (
                <Button onClick={generateQRCode} className="w-full">
                  Générer un QR Code
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
              <CardDescription>
                Détails de la session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  UUID Enseignant (Lovable Cloud)
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {airtableTeacherId || 'Non configuré'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  UUID Apprenant (Session)
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {sessionId || 'Aucune session'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  URL de Capture
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {qrUrl || 'Aucune URL'}
                </p>
              </div>
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Instructions</h3>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li>1. Affichez le QR code sur un écran ou imprimez-le</li>
                  <li>2. Les apprenants scannent le code avec leur smartphone</li>
                  <li>3. Ils accèdent directement à la page de capture</li>
                  <li>4. Leurs enregistrements seront automatiquement liés à votre classe</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
