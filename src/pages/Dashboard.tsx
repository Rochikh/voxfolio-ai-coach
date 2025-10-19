import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Users, BookOpen, QrCode } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isEnseignant, setIsEnseignant] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      checkRole();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    setProfile(data);
  };

  const checkRole = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'enseignant')
      .maybeSingle();

    setIsEnseignant(!!data);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la déconnexion',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Déconnexion',
        description: 'À bientôt !',
      });
      navigate('/login');
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
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bienvenue {profile?.prenom} {profile?.nom}
          </h2>
          <p className="text-muted-foreground">
            {isEnseignant ? 'Espace enseignant' : 'Votre compte'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="mr-2 h-5 w-5" />
                QR Code
              </CardTitle>
              <CardDescription>
                Générez un QR code pour vos apprenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/qr-generator')}>
                Générer un QR Code
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Mes classes
              </CardTitle>
              <CardDescription>
                Gérez vos classes et vos apprenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/classes')}>
                Voir mes classes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                Productions
              </CardTitle>
              <CardDescription>
                Consultez les productions de vos apprenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/showcase')}>
                Voir les productions
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
