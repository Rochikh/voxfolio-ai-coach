import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PortfolioItem {
  id: string;
  image: string;
  prenom: string;
  objectif?: string;
  created: string;
  classe?: string;
}

const Showcase = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFromQR, setIsFromQR] = useState(false);
  const [qrTeacherId, setQrTeacherId] = useState<string | null>(null);
  const [qrClassId, setQrClassId] = useState<string | null>(null);

  useEffect(() => {
    // Check for QR code parameters
    const teacherIdFromQR = searchParams.get('teacher');
    const classIdFromQR = searchParams.get('class');
    
    if (teacherIdFromQR && classIdFromQR) {
      setIsFromQR(true);
      setQrTeacherId(teacherIdFromQR);
      setQrClassId(classIdFromQR);
      // Load class name and set it as filter
      loadClassAndFetchPortfolios(teacherIdFromQR, classIdFromQR);
    } else if (!authLoading && !user) {
      navigate('/login');
      return;
    } else if (user) {
      fetchPortfolios();
    }
  }, [user, authLoading, navigate, searchParams]);

  const loadClassAndFetchPortfolios = async (teacherId: string, classId: string) => {
    try {
      console.log('Loading class from QR code:', { teacherId, classId });
      
      // Use list-classes function to get class name (allows unauthenticated access)
      const { data: classesData, error: classError } = await supabase.functions.invoke('list-classes', {
        body: { teacherId, classIds: [classId] }
      });

      console.log('Classes data from edge function:', classesData);

      if (classError) {
        console.error('Error loading classes:', classError);
        throw classError;
      }

      // Expect a single match
      const targetClass = classesData.classes?.[0];
      
      if (targetClass) {
        console.log('Setting selectedClass to:', targetClass.nom);
        setSelectedClass(targetClass.nom);
        await fetchPortfolios(targetClass.nom, teacherId);
      } else {
        console.warn('Class not found via edge function, proceeding without class filter');
        setSelectedClass('all');
        await fetchPortfolios(undefined, teacherId);
      }
    } catch (error) {
      console.error('Error loading class:', error);
      toast.error('Classe introuvable');
      setLoading(false);
    }
  };

  const fetchPortfolios = async (classFilter?: string, teacherIdOverride?: string) => {
    const effectiveTeacherId = teacherIdOverride || (user ? user.id : qrTeacherId);
    
    if (!effectiveTeacherId) return;

    try {
      console.log("📊 Fetching portfolios:", { 
        effectiveTeacherId, 
        classFilter,
        isFromQR,
        user: user?.id 
      });

      // Call Edge Function to fetch portfolios from Airtable filtered by UUID only (avoid class filter issues)
      const { data, error } = await supabase.functions.invoke('fetch-airtable', {
        body: { 
          teacherId: effectiveTeacherId
        }
      });

      console.log("📥 Response from edge function:", { data, error });

      if (error) throw error;

      const mappedPortfolios = data.records.map((record: any) => ({
        id: record.id,
        image: record.image || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop",
        prenom: record.prenom,
        objectif: record.objectif,
        created: record.created,
        classe: record.classe
      }));

      console.log(`✅ Mapped ${mappedPortfolios.length} portfolios:`, mappedPortfolios);

      // Extract unique classes from portfolios (only if not from QR)
      if (!isFromQR) {
        const uniqueClasses = Array.from(
          new Set(mappedPortfolios.map((p: PortfolioItem) => p.classe).filter(Boolean))
        ) as string[];
        
        console.log('Unique classes found:', uniqueClasses);
        setClasses(uniqueClasses);
      }
      
      setPortfolios(mappedPortfolios);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching portfolios:", error);
      toast.error("Erreur lors du chargement des portfolios");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass && !isFromQR) {
      fetchPortfolios(selectedClass);
    }
  }, [selectedClass]);

  const filteredPortfolios = portfolios
    .filter((portfolio) => {
      const matchesSearch = portfolio.prenom.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = selectedClass === "all" || portfolio.classe === selectedClass;
      return matchesSearch && matchesClass;
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                VOXFOLIO
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isFromQR 
                  ? (selectedClass !== 'all' ? `Vitrine des productions - ${selectedClass}` : 'Vitrine des productions')
                  : 'Vitrine des portfolios de votre classe'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {user && !isFromQR && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
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

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Class Filter Tabs - Only show if not from QR */}
        {!isFromQR && classes.length > 0 && (
          <div className="mb-6">
            <Tabs value={selectedClass} onValueChange={setSelectedClass}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="all">Toutes les classes</TabsTrigger>
                {classes.map((classe) => (
                  <TabsTrigger key={classe} value={classe}>
                    {classe}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Search */}
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

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : filteredPortfolios.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun portfolio trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPortfolios.map((portfolio) => (
              <Card
                key={portfolio.id}
                className="overflow-hidden cursor-pointer hover:shadow-primary transition-all duration-300 hover:scale-105 group"
                onClick={() => {
                  sessionStorage.setItem("airtableRecordId", portfolio.id);
                  navigate("/result");
                }}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={portfolio.image}
                    alt={`Portfolio de ${portfolio.prenom}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{portfolio.prenom}</h3>
                  {portfolio.objectif && (
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {portfolio.objectif}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {new Date(portfolio.created).toLocaleDateString("fr-FR", {
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
    </div>
  );
};

export default Showcase;
