import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, QrCode, Users, BookOpen, Shield, HelpCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function TeacherNav() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

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

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 
              className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate('/dashboard')}
            >
              Voxfolio
            </h1>
            
            <nav className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Tableau de bord
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/classes')}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Classes
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/qr-generator')}
                className="gap-2"
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/showcase')}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Productions
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/help')}
                className="gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                Aide
              </Button>
              
              {user?.email === "contact@rochane.fr" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              )}
            </nav>
          </div>

          <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
