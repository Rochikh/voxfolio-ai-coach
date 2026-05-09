import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Users, BookOpen, QrCode } from 'lucide-react';
import { TeacherNav } from '@/components/TeacherNav';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isEnseignant, setIsEnseignant] = useState(false);
  const stats = useDashboardStats();

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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bienvenue {profile?.prenom} {profile?.nom}
          </h2>
          <p className="text-muted-foreground">
            {isEnseignant ? 'Espace enseignant' : 'Votre compte'}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Activité de la semaine
            </CardTitle>
            <CardDescription>(7 derniers jours)</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats.loading &&
            stats.weeklyDone === 0 &&
            stats.inProgress === 0 &&
            stats.errors === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Pas encore d'activité cette semaine. Génère un QR code pour démarrer.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  {stats.loading ? (
                    <Skeleton className="h-10 w-16 mx-auto" />
                  ) : (
                    <div className="text-4xl font-bold">{stats.weeklyDone}</div>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">Cette semaine</p>
                </div>

                <div className="text-center">
                  {stats.loading ? (
                    <Skeleton className="h-10 w-16 mx-auto" />
                  ) : (
                    <div
                      className={`text-4xl font-bold ${
                        stats.inProgress > 0 ? 'text-blue-600' : ''
                      }`}
                    >
                      {stats.inProgress}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">En cours</p>
                </div>

                <div className="text-center">
                  {stats.loading ? (
                    <Skeleton className="h-10 w-16 mx-auto" />
                  ) : stats.errors > 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate('/showcase?status=error')}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <div className="text-4xl font-bold text-destructive">
                        {stats.errors}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">En erreur</p>
                    </button>
                  ) : (
                    <>
                      <div className="text-4xl font-bold">{stats.errors}</div>
                      <p className="text-sm text-muted-foreground mt-1">En erreur</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
